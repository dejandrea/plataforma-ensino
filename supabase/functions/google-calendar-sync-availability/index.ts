import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DateTime } from "npm:luxon@3.7.1";
import { corsHeaders } from "../_shared/cors.ts";
import {
  ensureFreshGoogleAccessToken,
  getGoogleCalendarFreeBusy,
} from "../_shared/google-calendar.ts";
import {readWeeklyAvailability, availabilityIntervals} from "../_shared/weekly-availability.ts";
import { getAuthenticatedProfile } from "../_shared/supabase.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const { adminClient, user, profile } = await getAuthenticatedProfile(req);
    const body = await req.json().catch(() => ({}));

    if (!["admin", "professor", "student"].includes(profile.role)) {
      throw new Error("Perfil sem permissao para sincronizar disponibilidade.");
    }

    let teacherId = user.id;

    if (profile.role === "admin" && typeof body?.teacherId === "string") {
      teacherId = body.teacherId;
    } else if (profile.role === "professor") {
      teacherId = user.id;
    } else if (profile.role === "student") {
      if (typeof body?.teacherId !== "string" || !body.teacherId) {
        throw new Error("teacherId e obrigatorio para sincronizar a disponibilidade via painel do aluno.");
      }

      const { data: relation, error: relationError } = await adminClient
        .from("teacher_student_relations")
        .select("teacher_id")
        .eq("teacher_id", body.teacherId)
        .eq("student_id", user.id)
        .maybeSingle();

      if (relationError) {
        throw new Error(relationError.message);
      }

      if (!relation) {
        throw new Error("Voce nao esta vinculado a esta professora.");
      }

      teacherId = body.teacherId;
    }

    const { data: settings, error: settingsError } = await adminClient
      .from("teacher_calendar_settings")
      .select("*")
      .eq("teacher_id", teacherId)
      .maybeSingle();

    if (settingsError) {
      throw new Error(settingsError.message);
    }

    if (!settings || !settings.is_active || settings.connection_status !== "connected") {
      throw new Error("Conecte e ative sua Google Agenda antes de sincronizar a disponibilidade.");
    }

    const selectedCalendarIds = Array.isArray(settings.availability_calendar_ids)
      ? settings.availability_calendar_ids.filter(Boolean)
      : Array.isArray(settings.sync_calendar_ids)
        ? settings.sync_calendar_ids.filter(Boolean)
      : settings.calendar_id
        ? [settings.calendar_id]
        : [];

    if (selectedCalendarIds.length === 0) {
      throw new Error("Selecione pelo menos uma agenda para sincronizar a disponibilidade.");
    }

    const timezone = settings.timezone || "America/Bahia";
    const slotMinutes = Number(settings.availability_slot_minutes ?? 60);
    const horizonDays = Number(settings.availability_horizon_days ?? 21);
    if(!Number.isInteger(horizonDays)||horizonDays<1||horizonDays>60)throw new Error("Escolha entre 1 e 60 dias futuros.");
    const schedule = readWeeklyAvailability(settings.availability_weekly_intervals,
      Array.isArray(settings.availability_weekdays)?settings.availability_weekdays:[1,2,3,4,5],
      settings.availability_start_time || "08:00", settings.availability_end_time || "18:00");
    const intervalsByDay = availabilityIntervals(schedule, settings.availability_start_time || "08:00", settings.availability_end_time || "18:00", slotMinutes);

    const now = DateTime.now().setZone(timezone);
    if(!now.isValid)throw new Error("Informe um fuso horário válido.");
    const rangeStart = now.startOf("day");
    const rangeEnd = rangeStart.plus({ days: horizonDays }).endOf("day");

    const tokenInfo = await ensureFreshGoogleAccessToken({
      adminClient,
      teacherId,
    });

    const freeBusyResponse = await getGoogleCalendarFreeBusy({
      accessToken: tokenInfo.accessToken,
      calendarIds: selectedCalendarIds,
      timeMin: rangeStart.toISO() || new Date().toISOString(),
      timeMax: rangeEnd.toISO() || new Date().toISOString(),
      timeZone: timezone,
    });

    if(selectedCalendarIds.some((id: string)=>!freeBusyResponse[id]||freeBusyResponse[id].errors?.length))throw new Error('Não foi possível verificar os conflitos de todas as agendas. Tente sincronizar novamente.');
    const busyIntervals = Object.values(freeBusyResponse)
      .flatMap((calendar: any) => Array.isArray(calendar?.busy) ? calendar.busy : [])
      .map((busy: any) => ({
        start: DateTime.fromISO(busy.start, { zone: timezone }),
        end: DateTime.fromISO(busy.end, { zone: timezone }),
      }));

    const { data: platformLessons, error: lessonsError } = await adminClient
      .from("scheduled_lessons")
      .select("starts_at, ends_at, status")
      .eq("teacher_id", teacherId)
      .in("status", ["scheduled", "completed"])
      .gt("ends_at", rangeStart.toISO() || new Date().toISOString())
      .lte("starts_at", rangeEnd.toISO() || new Date().toISOString());

    if (lessonsError) {
      throw new Error(lessonsError.message);
    }

    const platformIntervals = (platformLessons || [])
      .map((lesson: any) => ({
        start: DateTime.fromISO(lesson.starts_at, { zone: timezone }),
        end: DateTime.fromISO(lesson.ends_at, { zone: timezone }),
      }));

    const blockedIntervals = [...busyIntervals, ...platformIntervals];
    if(blockedIntervals.some(interval=>!interval.start.isValid||!interval.end.isValid||interval.end<=interval.start))throw new Error('Uma agenda retornou um intervalo de conflito inválido. Nenhum horário foi substituído.');

    const generatedSlots: Array<Record<string, unknown>> = [];

    // Include the previous weekday only for the future portion of overnight windows.
    for (let offset = -1; offset < horizonDays; offset += 1) {
      const day = rangeStart.plus({ days: offset });
      const atMinute = (minute: number) => day.plus({days:Math.floor(minute/1440)}).set({hour:Math.floor(minute/60)%24,minute:minute%60,second:0,millisecond:0});
      for (const interval of intervalsByDay[day.weekday]) {
        let slotStart = atMinute(interval.start);
        const dayEnd = atMinute(interval.end);
      while (slotStart.plus({ minutes: slotMinutes }) <= dayEnd) {
        const slotEnd = slotStart.plus({ minutes: slotMinutes });
        const isPast = slotStart <= now.plus({ minutes: 5 });
        const isBusy = blockedIntervals.some(
          (interval) => slotStart < interval.end && slotEnd > interval.start,
        );

        if (!isPast && !isBusy) {
          generatedSlots.push({
            created_by: teacherId,
            teacher_id: teacherId,
            student_id: null,
            title: "Horario disponivel para agendamento",
            description: "Disponibilidade sincronizada da Google Agenda.",
            session_track: "mentoring",
            status: "available",
            starts_at: slotStart.toUTC().toISO(),
            ends_at: slotEnd.toUTC().toISO(),
            meet_link: null,
            calendar_provider: "google_calendar_availability",
            calendar_calendar_id: selectedCalendarIds[0] || null,
            calendar_event_id: null,
            recurrence_group_id: null,
            recurrence_index: 1,
            booked_at: null,
            updated_at: new Date().toISOString(),
          });
        }

        slotStart = slotStart.plus({ minutes: slotMinutes });
      }
    }
    }

    const { error: cleanupError } = await adminClient
      .from("scheduled_lessons")
      .delete()
      .eq("teacher_id", teacherId)
      .eq("status", "available")
      .eq("calendar_provider", "google_calendar_availability");

    if (cleanupError) {
      throw new Error(cleanupError.message);
    }

    if (generatedSlots.length > 0) {
      const { error: insertError } = await adminClient
        .from("scheduled_lessons")
        .insert(generatedSlots);

      if (insertError) {
        throw new Error(insertError.message);
      }
    }

    return new Response(
      JSON.stringify({
        synced: true,
        availableSlots: generatedSlots.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro desconhecido.",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
