import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DateTime } from "npm:luxon@3.7.1";
import { corsHeaders } from "../_shared/cors.ts";
import {
  ensureFreshGoogleAccessToken,
  getGoogleCalendarFreeBusy,
} from "../_shared/google-calendar.ts";
import { getAuthenticatedProfile } from "../_shared/supabase.ts";

const parseTimeParts = (value: string, fallbackHour: number, fallbackMinute: number) => {
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number.parseInt(hourRaw || "", 10);
  const minute = Number.parseInt(minuteRaw || "", 10);

  return {
    hour: Number.isFinite(hour) ? hour : fallbackHour,
    minute: Number.isFinite(minute) ? minute : fallbackMinute,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const { adminClient, user, profile } = await getAuthenticatedProfile(req);

    if (!["admin", "professor"].includes(profile.role)) {
      throw new Error("Apenas professoras e admins podem sincronizar disponibilidade.");
    }

    const { data: settings, error: settingsError } = await adminClient
      .from("teacher_calendar_settings")
      .select("*")
      .eq("teacher_id", user.id)
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
    const allowedWeekdays = Array.isArray(settings.availability_weekdays)
      ? settings.availability_weekdays.filter((value: unknown) => Number.isInteger(value))
      : [1, 2, 3, 4, 5];
    const slotMinutes = Math.max(Number(settings.availability_slot_minutes) || 60, 15);
    const horizonDays = Math.min(Math.max(Number(settings.availability_horizon_days) || 21, 1), 60);
    const startTime = parseTimeParts(settings.availability_start_time || "08:00", 8, 0);
    const endTime = parseTimeParts(settings.availability_end_time || "18:00", 18, 0);

    const now = DateTime.now().setZone(timezone);
    const rangeStart = now.startOf("day");
    const rangeEnd = rangeStart.plus({ days: horizonDays }).endOf("day");

    const tokenInfo = await ensureFreshGoogleAccessToken({
      adminClient,
      teacherId: user.id,
    });

    const freeBusyResponse = await getGoogleCalendarFreeBusy({
      accessToken: tokenInfo.accessToken,
      calendarIds: selectedCalendarIds,
      timeMin: rangeStart.toISO() || new Date().toISOString(),
      timeMax: rangeEnd.toISO() || new Date().toISOString(),
      timeZone: timezone,
    });

    const busyIntervals = Object.values(freeBusyResponse)
      .flatMap((calendar: any) => Array.isArray(calendar?.busy) ? calendar.busy : [])
      .map((busy: any) => ({
        start: DateTime.fromISO(busy.start, { zone: timezone }),
        end: DateTime.fromISO(busy.end, { zone: timezone }),
      }));

    const { data: platformLessons, error: lessonsError } = await adminClient
      .from("scheduled_lessons")
      .select("starts_at, ends_at, status")
      .eq("teacher_id", user.id)
      .in("status", ["scheduled", "completed"])
      .gte("starts_at", rangeStart.toISO() || new Date().toISOString())
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

    const generatedSlots: Array<Record<string, unknown>> = [];

    for (let offset = 0; offset < horizonDays; offset += 1) {
      const day = rangeStart.plus({ days: offset });

      if (!allowedWeekdays.includes(day.weekday)) {
        continue;
      }

      let slotStart = day.set({
        hour: startTime.hour,
        minute: startTime.minute,
        second: 0,
        millisecond: 0,
      });
      const dayEnd = day.set({
        hour: endTime.hour,
        minute: endTime.minute,
        second: 0,
        millisecond: 0,
      });

      while (slotStart.plus({ minutes: slotMinutes }) <= dayEnd) {
        const slotEnd = slotStart.plus({ minutes: slotMinutes });
        const isPast = slotStart <= now.plus({ minutes: 5 });
        const isBusy = blockedIntervals.some(
          (interval) => slotStart < interval.end && slotEnd > interval.start,
        );

        if (!isPast && !isBusy) {
          generatedSlots.push({
            teacher_id: user.id,
            created_by: user.id,
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

    const { error: cleanupError } = await adminClient
      .from("scheduled_lessons")
      .delete()
      .eq("teacher_id", user.id)
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
