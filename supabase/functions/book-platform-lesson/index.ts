import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  createGoogleCalendarEvent,
  ensureFreshGoogleAccessToken,
  extractMeetLink,
} from "../_shared/google-calendar.ts";
import { getAuthenticatedProfile } from "../_shared/supabase.ts";

const buildLessonTitle = ({
  currentTitle,
  sessionTrack,
  studentName,
}: {
  currentTitle: string | null;
  sessionTrack: "mentoring" | "course";
  studentName: string;
}) => {
  if (
    currentTitle &&
    currentTitle !== "Horario disponivel para agendamento" &&
    currentTitle !== "Horario disponivel para aula"
  ) {
    return currentTitle;
  }

  return sessionTrack === "course"
    ? `Aula - ${studentName}`
    : `Mentoria - ${studentName}`;
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

    if (profile.role !== "student") {
      throw new Error("Apenas alunos podem reservar este horario.");
    }

    const body = await req.json().catch(() => ({}));
    const lessonId = typeof body?.lessonId === "string" ? body.lessonId : "";

    if (!lessonId) {
      throw new Error("lessonId e obrigatorio.");
    }

    const { data: lesson, error: lessonError } = await adminClient
      .from("scheduled_lessons")
      .select("*")
      .eq("id", lessonId)
      .maybeSingle();

    if (lessonError) {
      throw new Error(lessonError.message);
    }

    if (!lesson || lesson.status !== "available" || lesson.student_id) {
      throw new Error("Este horario nao esta mais disponivel.");
    }

    const { data: relation, error: relationError } = await adminClient
      .from("teacher_student_relations")
      .select("student_id")
      .eq("teacher_id", lesson.teacher_id)
      .eq("student_id", user.id)
      .maybeSingle();

    if (relationError) {
      throw new Error(relationError.message);
    }

    if (!relation) {
      throw new Error("Voce nao esta vinculado a esta professora.");
    }

    const { data: settings, error: settingsError } = await adminClient
      .from("teacher_calendar_settings")
      .select("*")
      .eq("teacher_id", lesson.teacher_id)
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
    const studentName = profile?.full_name?.trim() || "Aluno";
    const nextTitle = buildLessonTitle({
      currentTitle: lesson.title || null,
      sessionTrack: lesson.session_track === "course" ? "course" : "mentoring",
      studentName,
    });

    let googleEventId: string | null = null;
    let googleMeetLink: string | null = null;

    if (hasGoogleCalendar) {
      if (!calendarId) {
        throw new Error(
          "A professora ainda nao escolheu qual agenda do Google sera usada para os agendamentos.",
        );
      }

      const tokenInfo = await ensureFreshGoogleAccessToken({
        adminClient,
        teacherId: lesson.teacher_id,
      });
      let studentEmail: string | null = null;

      try {
        studentEmail = await getStudentInviteEmail(adminClient, user.id);
      } catch (emailError) {
        console.warn(
          "Nao foi possivel resolver o e-mail do aluno para convite automatico:",
          emailError instanceof Error ? emailError.message : emailError,
        );
      }

      const event = await createGoogleCalendarEvent({
          accessToken: tokenInfo.accessToken,
          calendarId,
        summary: nextTitle,
        description: lesson.description || null,
        startDateTime: lesson.starts_at,
        endDateTime: lesson.ends_at,
        timezone,
        attendeeEmails: studentEmail ? [studentEmail] : [],
        autoCreateMeet,
      });

      googleEventId = typeof event?.id === "string" ? event.id : null;
      googleMeetLink = extractMeetLink(event);
    }

    const { data: updatedLesson, error: updateError } = await adminClient
      .from("scheduled_lessons")
      .update({
        student_id: user.id,
        title: nextTitle,
        status: "scheduled",
        booked_at: new Date().toISOString(),
        meet_link: googleMeetLink || lesson.meet_link || null,
        calendar_provider: googleEventId ? "google_calendar" : lesson.calendar_provider,
        calendar_calendar_id: googleEventId ? calendarId : lesson.calendar_calendar_id,
        calendar_event_id: googleEventId || lesson.calendar_event_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lessonId)
      .eq("status", "available")
      .is("student_id", null)
      .select("*")
      .maybeSingle();

    if (updateError) {
      throw new Error(updateError.message);
    }

    if (!updatedLesson) {
      throw new Error("Este horario nao esta mais disponivel.");
    }

    return new Response(
      JSON.stringify({
        lesson: updatedLesson,
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
