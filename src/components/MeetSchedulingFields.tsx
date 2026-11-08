import {useEffect, useRef, useState} from 'react';
import {supabase} from '../lib/supabaseClient';
import {normalizeMeetLink} from '../../supabase/functions/_shared/meet-link';

type MeetChoice = {meetLink: string; useDefaultMeet: boolean};
export function MeetReservationFields({teacherId, studentId, existingLink, value, onChange, preferencesOnly = false}: {
  teacherId: string; studentId: string; existingLink?: string | null; value: MeetChoice; onChange: (value: MeetChoice) => void; preferencesOnly?: boolean;
}) {
  const [preferred, setPreferred] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const change = useRef(onChange);
  useEffect(() => {change.current = onChange;}, [onChange]);
  useEffect(() => {
    let alive = true;
    setPreferred(''); setDraft(''); setError(''); setNotice('');
    change.current({meetLink: existingLink || '', useDefaultMeet: false});
    if (!studentId || !teacherId) return;
    setLoading(true);
    void supabase.from('teacher_student_relations').select('default_meet_link').eq('teacher_id', teacherId).eq('student_id', studentId).maybeSingle().then(({data, error}) => {
      if (!alive) return;
      setLoading(false);
      if (error) {setError('O link padrão não pôde ser consultado. Confira a migration do ambiente.'); return;}
      const link = data?.default_meet_link || '';
      setPreferred(link); setDraft(link);
      change.current({meetLink: existingLink || link, useDefaultMeet: Boolean(link) && !existingLink});
    });
    return () => {alive = false;};
  }, [teacherId, studentId, existingLink]);
  async function saveDefault() {
    setError(''); setNotice(''); setBusy(true);
    try {
      const link = normalizeMeetLink(draft);
      const {data, error} = await supabase.rpc('set_student_meet_link', {p_teacher_id: teacherId, p_student_id: studentId, p_link: link});
      if (error || data !== studentId) throw new Error('Não foi possível salvar o link padrão. Verifique suas permissões e a preparação do ambiente.');
      setPreferred(link || ''); setDraft(link || '');
      if (value.useDefaultMeet) onChange({meetLink: link || '', useDefaultMeet: Boolean(link)});
      setNotice('Padrão salvo para novos agendamentos deste aluno com esta professora. As aulas existentes foram preservadas.');
    } catch (cause) {setError(cause instanceof Error ? cause.message : 'Falha ao salvar.');}
    finally {setBusy(false);}
  }
  return <fieldset className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-white/10" disabled={loading || busy || !studentId}>
    <legend className="px-2 font-bold text-white">Sala do Google Meet</legend>
    {loading && <p role="status">Consultando link padrão…</p>}
    {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
    {notice && <p role="status" className="text-sm text-brand-ice">{notice}</p>}
    <label className="block text-sm text-white">Link padrão do aluno
      <input type="url" value={draft} placeholder="https://meet.google.com/abc-defg-hij" onChange={e => setDraft(e.target.value)} className="mt-2 w-full rounded-xl bg-background p-3" />
    </label>
    <button type="button" className="btn-secondary" onClick={() => void saveDefault()}>Salvar link padrão</button>
    <p className="text-xs text-white/65">Deixe o padrão vazio e salve para desativá-lo. Isso não altera o histórico.</p>
    {!preferencesOnly && <><label className="flex items-center gap-3 text-sm text-white"><input type="checkbox" checked={value.useDefaultMeet} disabled={!preferred} onChange={e => onChange({useDefaultMeet: e.target.checked, meetLink: e.target.checked ? preferred : existingLink || ''})} />Usar link fixo do Google Meet para este aluno</label>
    <label className="block text-sm text-white">Link destas novas aulas (opcional)
      <input type="url" value={value.meetLink} placeholder="Vazio: manter a sala existente ou gerar automaticamente" onChange={e => onChange({meetLink: e.target.value, useDefaultMeet: false})} className="mt-2 w-full rounded-xl bg-background p-3" />
    </label></>}
    <p className="text-xs text-white/65">Um link informado evita gerar outra conferência. Uma exceção aqui não modifica o padrão. O Meet continua sujeito às permissões e à validade definidas pelo Google.</p>
  </fieldset>;
}

export function StudentMeetDefaults({studentId}: {studentId: string}) {
  const [teachers, setTeachers] = useState<{teacher_id: string; name: string}[]>([]);
  const [teacherId, setTeacherId] = useState('');
  const [choice, setChoice] = useState<MeetChoice>({meetLink: '', useDefaultMeet: false});
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    void supabase.from('teacher_student_relations').select('teacher_id,teacher:profiles!teacher_id(full_name)').eq('student_id', studentId).then(({data, error}) => {
      if (!alive) return;
      if (error) {setError('Não foi possível consultar os vínculos para configurar o Meet.'); return;}
      const rows = (data || []).map(item => ({teacher_id: item.teacher_id, name: (Array.isArray(item.teacher) ? item.teacher[0] : item.teacher)?.full_name || 'Professora'}));
      setTeachers(rows); setTeacherId(rows[0]?.teacher_id || '');
    });
    return () => {alive = false;};
  }, [studentId]);
  return <details className="my-5 rounded-2xl bg-surface p-4 text-white ring-1 ring-white/10">
    <summary className="cursor-pointer font-semibold">Link padrão do Meet deste aluno</summary>
    {error && <p role="alert">{error}</p>}
    {teachers.length > 1 && <label className="my-3 block">Professora<select className="ml-3 rounded bg-background p-2" value={teacherId} onChange={e => setTeacherId(e.target.value)}>{teachers.map(t => <option key={t.teacher_id} value={t.teacher_id}>{t.name}</option>)}</select></label>}
    {teacherId && <MeetReservationFields teacherId={teacherId} studentId={studentId} value={choice} onChange={setChoice} preferencesOnly />}
  </details>;
}

export function LessonMeetEditor({lesson}: {lesson: {id: string; status: string; starts_at: string; meet_link?: string | null; calendar_event_id?: string | null}}) {
  const [open, setOpen] = useState(false), [link, setLink] = useState(''), [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (lesson.status !== 'scheduled' || Date.parse(lesson.starts_at) <= Date.now()) return null;
  return <div className="mt-3 text-sm">
    <button type="button" className="btn-secondary" onClick={() => {setOpen(!open); setLink(lesson.meet_link || ''); setConfirmed(false); setError('');}}>Alterar Meet desta aula</button>
    {open && <div className="mt-3 space-y-3">
      <label className="block">Link apenas desta aula<input aria-label="Link apenas desta aula" type="url" className="mt-2 w-full rounded-xl bg-background p-3" value={link} onChange={e => setLink(e.target.value)} /></label>
      {lesson.calendar_event_id && <label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Confirmo a substituição da sala deste evento Google e a notificação dos convidados.</label>}
      <p>O link padrão e as outras aulas serão preservados.</p>
      {error && <p role="alert">{error}</p>}
      <button type="button" className="btn-primary" disabled={busy || Boolean(lesson.calendar_event_id && !confirmed)} onClick={async () => {
        setBusy(true); setError('');
        try {
          const normalized = normalizeMeetLink(link); if (!normalized) throw new Error('Informe o link desta aula.');
          const {error} = await supabase.functions.invoke('update-lesson-meet', {body: {lessonId: lesson.id, meetLink: normalized, expectedMeetLink: lesson.meet_link || null, confirmExternalChange: confirmed}});
          if (error) throw new Error('Não foi possível alterar o Meet. Atualize a agenda e confira o evento antes de tentar novamente.');
          setOpen(false); window.dispatchEvent(new Event('bitaria-meet-updated'));
        } catch (cause) {setError(cause instanceof Error ? cause.message : 'Falha ao alterar.');}
        finally {setBusy(false);}
      }}>Salvar somente nesta aula</button>
    </div>}
  </div>;
}
