import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  createGoogleCalendarEvent,
  ensureFreshGoogleAccessToken,
  extractMeetLink,
} from "../_shared/google-calendar.ts";
import { getAuthenticatedProfile } from "../_shared/supabase.ts";
import { assertStudentCanBook } from "../_shared/billing.ts";
import {planRecurrence,shiftZonedWeeks} from '../_shared/recurrence.ts';

type ConfirmLessonPayload = {
  lessonId?: string;
  studentId?: string;
  sessionTrack?: "mentoring" | "course";
  isRecurring?: boolean;
  recurrenceCount?: string | number;
  recurrenceWeekdays?: number[];
  recurrenceUntil?: string;
  requestId?: string;
};

type RecurrenceTarget = {
  recurrenceIndex: number;
  startsAt: string;
  endsAt: string;
  requestedStartsAt: string;
  requestedEndsAt: string;
  skippedConflictDates: string[];
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

const addWeeks = shiftZonedWeeks;

const overlapsWith = (
  item: { starts_at: string; ends_at: string },
  startsAt: string,
  endsAt: string,
) => item.starts_at < endsAt && item.ends_at > startsAt;

const hasSameRange = (
  item: { starts_at: string; ends_at: string },
  startsAt: string,
  endsAt: string,
) =>
  new Date(item.starts_at).getTime() === new Date(startsAt).getTime() &&
  new Date(item.ends_at).getTime() === new Date(endsAt).getTime();

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
      ? Number(body.recurrenceCount || 1)
      : 1;
    const requestId=body.requestId||crypto.randomUUID();
    if(!/^[0-9a-f-]{36}$/i.test(requestId)) throw new Error('Identificador de agendamento inválido.');

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

    if (!lesson || ((lesson.status !== "available" || lesson.student_id) && !(lesson.scheduling_request_id===requestId&&lesson.student_id===studentId&&lesson.status==='scheduled'))) {
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

    await assertStudentCanBook(adminClient, studentId);

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
    const requestedStarts=planRecurrence(lesson.starts_at,recurrenceCount,body.isRecurring?body.recurrenceWeekdays:undefined,timezone,body.isRecurring?body.recurrenceUntil:undefined);
    if(requestedStarts[0]!==new Date(lesson.starts_at).toISOString()) throw new Error('Inclua o dia do horário escolhido na recorrência.');
    const recurrenceGroupId = requestedStarts.length > 1 ? requestId : null;
    const maxExtraWeeks = 104;
    const searchEnd = addWeeks(lesson.starts_at, recurrenceCount + maxExtraWeeks);

    const { data: existingLessons, error: existingLessonsError } = await adminClient
      .from("scheduled_lessons")
      .select("*")
      .eq("teacher_id", user.id)
      .gte("starts_at", lesson.starts_at)
      .lte("starts_at", searchEnd);

    if (existingLessonsError) {
      throw new Error(existingLessonsError.message);
    }
    const prior=(existingLessons||[]).filter((row:any)=>row.scheduling_request_id===requestId);
    if(prior.some((row:any)=>row.student_id!==studentId||row.session_track!==sessionTrack)) throw new Error('Identificador já usado em outro agendamento.');
    if(prior.length===requestedStarts.length) return new Response(JSON.stringify({lesson:prior[0],lessons:prior,recurrenceReport:{hadConflicts:false,adjustedOccurrences:[]}}),{headers:{...corsHeaders,'Content-Type':'application/json'}});

    const futureTargets: RecurrenceTarget[] = [
      {
        recurrenceIndex: 1,
        startsAt: lesson.starts_at,
        endsAt: lesson.ends_at,
        requestedStartsAt: lesson.starts_at,
        requestedEndsAt: lesson.ends_at,
        skippedConflictDates: [],
      },
    ];

    for (let recurrenceIndex = 2; recurrenceIndex <= requestedStarts.length; recurrenceIndex += 1) {
      const baseWeekOffset = recurrenceIndex - 1;
      let candidateWeekOffset = 0;
      const skippedConflictDates: string[] = [];
      let acceptedTarget: RecurrenceTarget | null = null;

      while (candidateWeekOffset <= maxExtraWeeks) {
        const candidateStartsAt = addWeeks(requestedStarts[recurrenceIndex-1], candidateWeekOffset,timezone);
        if(body.recurrenceUntil&&new Intl.DateTimeFormat('en-CA',{timeZone:timezone}).format(new Date(candidateStartsAt))>body.recurrenceUntil) break;
        const candidateEndsAt = new Date(new Date(candidateStartsAt).getTime()+new Date(lesson.ends_at).getTime()-new Date(lesson.starts_at).getTime()).toISOString();
        const matchingAvailable = (existingLessons || []).find(
          (item: any) =>
            item.status === "available" &&
            !item.student_id &&
            hasSameRange(item, candidateStartsAt, candidateEndsAt),
        );
        const conflictsWithPlannedTarget = futureTargets.some(
          (plannedTarget) =>
            plannedTarget.startsAt < candidateEndsAt &&
            plannedTarget.endsAt > candidateStartsAt,
        );
        const conflictingLesson = (existingLessons || []).find(
          (item: any) =>
            item.id !== matchingAvailable?.id &&
            item.scheduling_request_id !== requestId &&
            item.status !== "available" &&
            item.status !== "cancelled" &&
            overlapsWith(item, candidateStartsAt, candidateEndsAt),
        );

        if (conflictsWithPlannedTarget || conflictingLesson) {
          skippedConflictDates.push(candidateStartsAt);
          candidateWeekOffset += 1;
          continue;
        }

        acceptedTarget = {
          recurrenceIndex,
          startsAt: candidateStartsAt,
          endsAt: candidateEndsAt,
          requestedStartsAt: requestedStarts[recurrenceIndex-1],
          requestedEndsAt: new Date(new Date(requestedStarts[recurrenceIndex-1]).getTime()+new Date(lesson.ends_at).getTime()-new Date(lesson.starts_at).getTime()).toISOString(),
          skippedConflictDates,
        };
        break;
      }

      if (!acceptedTarget) {
        throw new Error(
          `Nao foi possivel completar a recorrencia apos muitos conflitos a partir de ${addWeeks(
            lesson.starts_at,
            baseWeekOffset,
          )}.`,
        );
      }

      futureTargets.push(acceptedTarget);
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

      try {
        studentEmail = await getStudentInviteEmail(adminClient, studentId);
      } catch (emailError) {
        console.warn(
          "Nao foi possivel resolver o e-mail do aluno para convite automatico:",
          emailError instanceof Error ? emailError.message : emailError,
        );
      }
    }

    const confirmedLessons: any[] = [];

    for (const target of futureTargets) {
      const saved=prior.find((row:any)=>row.recurrence_index===target.recurrenceIndex);
      if(saved) {confirmedLessons.push(saved);continue;}
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
          attendeeEmails: studentEmail ? [studentEmail] : [],
          autoCreateMeet,
          eventId: requestId.replaceAll('-','')+target.recurrenceIndex.toString(16),
        });

        googleEventId = typeof event?.id === "string" ? event.id : null;
        googleMeetLink = extractMeetLink(event);
      }

      const matchingAvailable = (existingLessons || []).find(
        (item: any) =>
          item.status === "available" &&
          !item.student_id &&
          hasSameRange(item, target.startsAt, target.endsAt),
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
            scheduling_request_id: requestId,
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
          scheduling_request_id: requestId,
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
        recurrenceReport: {
          hadConflicts: futureTargets.some(
            (target) =>
              target.skippedConflictDates.length > 0 ||
              target.startsAt !== target.requestedStartsAt,
          ),
          adjustedOccurrences: futureTargets
            .filter(
              (target) =>
                target.skippedConflictDates.length > 0 ||
                target.startsAt !== target.requestedStartsAt,
            )
            .map((target) => ({
              recurrenceIndex: target.recurrenceIndex,
              requestedStartsAt: target.requestedStartsAt,
              assignedStartsAt: target.startsAt,
              skippedConflictDates: target.skippedConflictDates,
            })),
        },
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
