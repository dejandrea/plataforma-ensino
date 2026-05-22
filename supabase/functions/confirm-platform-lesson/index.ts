import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  createGoogleCalendarEvent,
  ensureFreshGoogleAccessToken,
  extractMeetLink,
} from "../_shared/google-calendar.ts";
import { getAuthenticatedProfile } from "../_shared/supabase.ts";

type ConfirmLessonPayload = {
  lessonId?: string;
  studentId?: string;
  sessionTrack?: "mentoring" | "course";
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
    throw new Error(
      "Nao encontramos o e-mail autorizado deste aluno. Confira o cadastro de acesso antes de agendar.",
    );
  }

  return String(data.email).toLowerCase();
};

const buildLessonTitle = ({
  currentTitle,
  sessionTrack,
  studentName,
}: {
  currentTitle: string | null;
  sessionTrack: "mentoring" | "course";
  studentName: string;
}) => {
  if (currentTitle && currentTitle !== "Horario disponivel para agendamento") {
    return currentTitle;
  }

  return sessionTrack === "course"
    ? `Aula - Curso completo - ${studentName}`
    : `Mentoria - ${studentName}`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const { adminClient, user, profile } = await getAuthenticatedProfile(req);

    if (!["admin", "professor"].includes(profile.role)) {
      throw new Error("Apenas professoras e admins podem confirmar aulas.");
    }

    const body = (await req.json().catch(() => ({}))) as ConfirmLessonPayload;
    const lessonId = typeof body.lessonId === "string" ? body.lessonId : "";
    const studentId = typeof body.studentId === "string" ? body.studentId : "";
    const sessionTrack = body.sessionTrack === "course" ? "course" : "mentoring";
    const recurrenceCount = body.isRecurring
      ? Math.max(parseInt(String(body.recurrenceCount || "1"), 10) || 1, 1)
      : 1;

    if (!lessonId) {
      throw new Error("lessonId e obrigatorio.");
    }

    if (!studentId) {
      throw new Error("studentId e obrigatorio.");
    }

    const { data: lesson, error: lessonError } = await adminClient
      .from("scheduled_lessons")
      .select("*")
      .eq("id", lessonId)
      .eq("teacher_id", user.id)
      .maybeSingle();

    if (lessonError) {
      throw new Error(lessonError.message);
    }

    if (!lesson || lesson.status !== "available" || lesson.student_id) {
      throw new Error("Este horario nao esta mais disponivel para agendamento.");
    }

    const { data: relation, error: relationError } = await adminClient
      .from("teacher_student_relations")
      .select("student_id")
      .eq("teacher_id", user.id)
      .eq("student_id", studentId)
      .maybeSingle();

    if (relationError) {
      throw new Error(relationError.message);
    }

    if (!relation) {
      throw new Error("Este aluno nao esta vinculado a esta professora.");
    }

    const { data: studentProfile, error: studentProfileError } = await adminClient
      .from("profiles")
      .select("full_name")
      .eq("id", studentId)
      .maybeSingle();

    if (studentProfileError) {
      throw new Error(studentProfileError.message);
    }

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

    const studentName = studentProfile?.full_name?.trim() || "Aluno";
    const nextTitle = buildLessonTitle({
      currentTitle: lesson.title || null,
      sessionTrack,
      studentName,
    });
    const recurrenceGroupId = recurrenceCount > 1 ? crypto.randomUUID() : null;

    const futureTargets = Array.from({ length: recurrenceCount }, (_, index) => {
      const startDate = new Date(lesson.starts_at);
      startDate.setDate(startDate.getDate() + index * 7);
      const endDate = new Date(lesson.ends_at);
      endDate.setDate(endDate.getDate() + index * 7);

      return {
        recurrenceIndex: index + 1,
        startsAt: startDate.toISOString(),
        endsAt: endDate.toISOString(),
      };
    });

    const { data: existingLessons, error: existingLessonsError } = await adminClient
      .from("scheduled_lessons")
      .select("*")
      .eq("teacher_id", user.id)
      .gte("starts_at", futureTargets[0].startsAt)
      .lte("starts_at", futureTargets[futureTargets.length - 1].startsAt);

    if (existingLessonsError) {
      throw new Error(existingLessonsError.message);
    }

    for (const target of futureTargets.slice(1)) {
      const matchingAvailable = (existingLessons || []).find(
        (item: any) =>
          item.status === "available" &&
          !item.student_id &&
          item.starts_at === target.startsAt &&
          item.ends_at === target.endsAt,
      );

      if (matchingAvailable) {
        continue;
      }

      const conflictingLesson = (existingLessons || []).find(
        (item: any) =>
          item.status !== "cancelled" &&
          item.starts_at < target.endsAt &&
          item.ends_at > target.startsAt,
      );

      if (conflictingLesson) {
        throw new Error(
          `Nao foi possivel criar a recorrencia porque ja existe conflito em ${target.startsAt}.`,
        );
      }
    }

    let tokenInfo:
      | {
          accessToken: string;
        }
      | null = null;
    let studentEmail: string | null = null;

    if (hasGoogleCalendar) {
      if (!calendarId) {
        throw new Error(
          "Selecione qual agenda do Google deseja usar antes de confirmar aulas com sincronizacao.",
        );
      }

      tokenInfo = await ensureFreshGoogleAccessToken({
        adminClient,
        teacherId: user.id,
      });
      studentEmail = await getStudentInviteEmail(adminClient, studentId);
    }

    const confirmedLessons: any[] = [];

    for (const target of futureTargets) {
      let googleEventId: string | null = null;
      let googleMeetLink: string | null = null;

      if (tokenInfo && studentEmail) {
        const event = await createGoogleCalendarEvent({
          accessToken: tokenInfo.accessToken,
          calendarId,
          summary: nextTitle,
          description: lesson.description || null,
          startDateTime: target.startsAt,
          endDateTime: target.endsAt,
          timezone,
          attendeeEmails: [studentEmail],
          autoCreateMeet,
        });

        googleEventId = typeof event?.id === "string" ? event.id : null;
        googleMeetLink = extractMeetLink(event);
      }

      const matchingAvailable = (existingLessons || []).find(
        (item: any) =>
          item.status === "available" &&
          !item.student_id &&
          item.starts_at === target.startsAt &&
          item.ends_at === target.endsAt,
      );

      if (matchingAvailable) {
        const { data: updatedLesson, error: updateError } = await adminClient
          .from("scheduled_lessons")
          .update({
            student_id: studentId,
            title: nextTitle,
            session_track: sessionTrack,
            status: "scheduled",
            recurrence_group_id: recurrenceGroupId,
            recurrence_index: target.recurrenceIndex,
            booked_at: new Date().toISOString(),
            meet_link: googleMeetLink || matchingAvailable.meet_link || null,
            calendar_provider: googleEventId ? "google_calendar" : matchingAvailable.calendar_provider,
            calendar_calendar_id: googleEventId ? calendarId : matchingAvailable.calendar_calendar_id,
            calendar_event_id: googleEventId || matchingAvailable.calendar_event_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", matchingAvailable.id)
          .eq("status", "available")
          .is("student_id", null)
          .select("*")
          .maybeSingle();

        if (updateError) {
          throw new Error(updateError.message);
        }

        if (!updatedLesson) {
          throw new Error("Um dos horarios da recorrencia nao esta mais disponivel.");
        }

        confirmedLessons.push(updatedLesson);
        continue;
      }

      const { data: insertedLesson, error: insertError } = await adminClient
        .from("scheduled_lessons")
        .insert({
          teacher_id: user.id,
          created_by: user.id,
          student_id: studentId,
          title: nextTitle,
          description: lesson.description || null,
          session_track: sessionTrack,
          status: "scheduled",
          starts_at: target.startsAt,
          ends_at: target.endsAt,
          meet_link: googleMeetLink || null,
          calendar_provider: googleEventId ? "google_calendar" : null,
          calendar_calendar_id: googleEventId ? calendarId : null,
          calendar_event_id: googleEventId,
          recurrence_group_id: recurrenceGroupId,
          recurrence_index: target.recurrenceIndex,
          booked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("*")
        .maybeSingle();

      if (insertError) {
        throw new Error(insertError.message);
      }

      if (insertedLesson) {
        confirmedLessons.push(insertedLesson);
      }
    }

    return new Response(
      JSON.stringify({
        lesson: confirmedLessons[0] || null,
        lessons: confirmedLessons,
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
