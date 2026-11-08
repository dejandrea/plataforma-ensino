import {serve} from 'https://deno.land/std@0.168.0/http/server.ts';
import {corsHeaders} from '../_shared/cors.ts';
import {getAuthenticatedProfile} from '../_shared/supabase.ts';
import {normalizeMeetLink} from '../_shared/meet-link.ts';
import {ensureFreshGoogleAccessToken, replaceGoogleEventMeet} from '../_shared/google-calendar.ts';

export async function handleUpdateLessonMeet(req: Request) {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: corsHeaders});
  try {
    if (req.method !== 'POST') throw new Error('Método não permitido.');
    const {adminClient, user, profile} = await getAuthenticatedProfile(req);
    const {data: active} = await adminClient.from('profiles').select('is_active').eq('id', user.id).single();
    if (!active?.is_active || !['admin', 'professor'].includes(profile.role)) throw new Error('Acesso não autorizado.');
    const body = await req.json();
    const meetLink = normalizeMeetLink(body.meetLink);
    if (!meetLink) throw new Error('Informe o link da aula.');
    const {data: lesson, error} = await adminClient.from('scheduled_lessons').select('*').eq('id', body.lessonId).single();
    if (error || !lesson || (profile.role !== 'admin' && lesson.teacher_id !== user.id)) throw new Error('Agendamento indisponível.');
    if (lesson.status !== 'scheduled' || Date.parse(lesson.starts_at) <= Date.now()) throw new Error('Altere somente aulas futuras agendadas.');
    if ((lesson.meet_link || null) !== (body.expectedMeetLink || null)) throw new Error('O link mudou. Atualize a agenda.');
    if (lesson.meet_link === meetLink) return Response.json({ok: true}, {headers: corsHeaders});
    if (lesson.calendar_event_id) {
      if (body.confirmExternalChange !== true) throw new Error('Confirme a substituição do Meet no evento Google e a notificação dos convidados.');
      const {accessToken} = await ensureFreshGoogleAccessToken({adminClient, teacherId: lesson.teacher_id});
      await replaceGoogleEventMeet({accessToken, calendarId: lesson.calendar_calendar_id, eventId: lesson.calendar_event_id, meetLink, confirmed: true});
    }
    let update = adminClient.from('scheduled_lessons').update({meet_link: meetLink}).eq('id', lesson.id).eq('status', 'scheduled');
    update = lesson.meet_link ? update.eq('meet_link', lesson.meet_link) : update.is('meet_link', null);
    const {data: saved, error: saveError} = await update.select('id').maybeSingle();
    if (saveError || !saved) throw new Error('Não foi possível confirmar a gravação local. Atualize/sincronize a agenda antes de tentar novamente.');
    return Response.json({ok: true}, {headers: corsHeaders});
  } catch (error) {
    return Response.json({error: error instanceof Error ? error.message : 'Falha ao alterar a sala.'}, {status: 400, headers: corsHeaders});
  }
}
serve(handleUpdateLessonMeet);
