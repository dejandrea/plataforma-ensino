import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  createGoogleCalendarEvent,
  ensureFreshGoogleAccessToken,
  extractMeetLink,
} from "../_shared/google-calendar.ts";
import { getAuthenticatedProfile } from "../_shared/supabase.ts";

type LessonPayload = {
  mode: "available" | "scheduled";
  sessionTrack: "mentoring" | "course";
  title?: string;
  description?: string;
  studentId?: string;
  startsAt: string;
  durationMinutes?: string | number;
  meetLink?: string;
  isRecurring?: boolean;
  recurrenceCount?: string | number;
};

const getStudentInviteEmail = async (adminClient: any, studentId: string) => {
  const { data, error } = await adminClient
    .from("access_invites")
    .select("email")
    .eq("claimed_user_id", studentId)
    .eq("role", "student")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.email) {
    const { data: authUserData, error: authUserError } =
      await adminClient.auth.admin.getUserById(studentId);

    if (authUserError) {
      throw new Error(authUserError.message);
    }

    const authEmail = authUserData?.user?.email;
    if (authEmail) {
      return String(authEmail).toLowerCase();
    }

    throw new Error(
      "Nao foi possivel localizar o e-mail deste aluno para enviar o convite da aula.",
    );
  }

  return String(data.email).toLowerCase();
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const { adminClient, user, profile } = await getAuthenticatedProfile(req);

    if (!["admin", "professor"].includes(profile.role)) {
      throw new Error("Apenas professoras e admins podem agendar aulas.");
    }

    const body = (await req.json()) as LessonPayload;
    const mode = body?.mode === "scheduled" ? "scheduled" : "available";
    const sessionTrack = body?.sessionTrack === "course" ? "course" : "mentoring";
    const startsAt = body?.startsAt;

    if (!startsAt) {
      throw new Error("Escolha a data e hora da aula.");
    }

    if (mode === "scheduled" && !body.studentId) {
      throw new Error("Selecione um aluno para confirmar a aula.");
    }

    if (mode === "scheduled") {
      const { data: relation, error: relationError } = await adminClient
        .from("teacher_student_relations")
        .select("student_id")
        .eq("teacher_id", user.id)
        .eq("student_id", body.studentId)
        .maybeSingle();

      if (relationError) {
        throw new Error(relationError.message);
      }

      if (!relation) {
        throw new Error("Este aluno nao esta vinculado a esta professora.");
      }
    }

    const recurrenceCount = body.isRecurring
      ? Math.max(parseInt(String(body.recurrenceCount || "1"), 10) || 1, 1)
      : 1;
    const recurrenceGroupId = recurrenceCount > 1 ? crypto.randomUUID() : null;
    const startDate = new Date(startsAt);
    const durationMinutes = Math.max(parseInt(String(body.durationMinutes || "60"), 10) || 60, 15);

    const { data: settings, error: settingsError } = await adminClient
      .from("teacher_calendar_settings")
      .select("*")
      .eq("teacher_id", user.id)
      .maybeSingle();

    if (settingsError) {
      throw new Error(settingsError.message);
    }

    const hasGoogleCalendar =
      Boolean(settings?.is_active) && settings?.connection_status === "connected";
    const selectedCalendarIds = Array.isArray(settings?.event_calendar_ids)
      ? settings.event_calendar_ids.filter(Boolean)
      : Array.isArray(settings?.sync_calendar_ids)
        ? settings.sync_calendar_ids.filter(Boolean)
      : settings?.calendar_id
        ? [settings.calendar_id]
        : [];
    const calendarId = selectedCalendarIds[0] || settings?.calendar_id || null;
    const timezone = settings?.timezone || "America/Bahia";
    const autoCreateMeet = settings?.auto_create_meet ?? true;

    let tokenInfo:
      | {
          accessToken: string;
        }
      | null = null;

    let studentEmail: string | null = null;

    if (hasGoogleCalendar && mode === "scheduled" && body.studentId) {
      if (!calendarId) {
        throw new Error(
          "Selecione qual agenda do Google deseja usar antes de agendar aulas com sincronizacao.",
        );
      }

      tokenInfo = await ensureFreshGoogleAccessToken({
        adminClient,
        teacherId: user.id,
      });

      try {
        studentEmail = await getStudentInviteEmail(adminClient, body.studentId);
      } catch (emailError) {
        console.warn(
          "Nao foi possivel resolver o e-mail do aluno para convite automatico:",
          emailError instanceof Error ? emailError.message : emailError,
        );
      }
    }

    const records = [];

    for (let index = 0; index < recurrenceCount; index += 1) {
      const lessonStart = new Date(startDate);
      lessonStart.setDate(startDate.getDate() + index * 7);

      const lessonEnd = new Date(lessonStart);
      lessonEnd.setMinutes(lessonEnd.getMinutes() + durationMinutes);

      let googleEventId: string | null = null;
      let googleMeetLink: string | null = null;

      if (tokenInfo && mode === "scheduled") {
        const event = await createGoogleCalendarEvent({
          accessToken: tokenInfo.accessToken,
          calendarId,
          summary:
            body.title?.trim() ||
            "Aula confirmada",
          description: body.description?.trim() || null,
          startDateTime: lessonStart.toISOString(),
          endDateTime: lessonEnd.toISOString(),
          timezone,
          attendeeEmails: studentEmail ? [studentEmail] : [],
          autoCreateMeet,
        });

        googleEventId = typeof event?.id === "string" ? event.id : null;
        googleMeetLink = extractMeetLink(event);
      }

      records.push({
        teacher_id: user.id,
        created_by: user.id,
        student_id: mode === "scheduled" ? body.studentId : null,
        title:
          body.title?.trim() ||
          (mode === "available" ? "Horario disponivel para aula" : "Aula confirmada"),
        description: body.description?.trim() || null,
        session_track: sessionTrack,
        status: mode === "available" ? "available" : "scheduled",
        starts_at: lessonStart.toISOString(),
        ends_at: lessonEnd.toISOString(),
        meet_link: googleMeetLink || body.meetLink?.trim() || null,
        calendar_provider: googleEventId ? "google_calendar" : null,
        calendar_calendar_id: googleEventId ? calendarId : null,
        calendar_event_id: googleEventId,
        recurrence_group_id: recurrenceGroupId,
        recurrence_index: index + 1,
        booked_at: mode === "scheduled" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      });
    }

    const { data: insertedLessons, error: insertError } = await adminClient
      .from("scheduled_lessons")
      .insert(records)
      .select("*");

    if (insertError) {
      throw new Error(insertError.message);
    }

    return new Response(
      JSON.stringify({
        lessons: insertedLessons || [],
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
