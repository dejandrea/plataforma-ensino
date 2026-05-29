import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  createGoogleCalendarEvent,
  ensureFreshGoogleAccessToken,
  extractMeetLink,
  updateGoogleCalendarEvent,
} from "../_shared/google-calendar.ts";
import { getAuthenticatedProfile } from "../_shared/supabase.ts";

type RescheduleScope = "single" | "this_and_following";

type ReschedulePayload = {
  lessonId?: string;
  startsAt?: string;
  scope?: RescheduleScope;
};

type LessonTarget = {
  lesson: any;
  startsAt: string;
  endsAt: string;
};

const addWeeks = (value: string, weeks: number) => {
  const date = new Date(value);
  date.setDate(date.getDate() + weeks * 7);
  return date.toISOString();
};

const overlapsWith = (
  item: { starts_at: string; ends_at: string },
  startsAt: string,
  endsAt: string,
) => item.starts_at < endsAt && item.ends_at > startsAt;

const formatDateTime = (value: string, timezone: string) =>
  new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: timezone,
  });

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
      "Nao foi possivel localizar o e-mail deste aluno para atualizar o convite da aula.",
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

    if (!["admin", "professor", "student"].includes(profile.role)) {
      throw new Error("Voce nao tem permissao para reagendar aulas.");
    }

    const body = (await req.json().catch(() => ({}))) as ReschedulePayload;
    const lessonId = typeof body.lessonId === "string" ? body.lessonId : "";
    const startsAt = typeof body.startsAt === "string" ? body.startsAt : "";
    const scope: RescheduleScope =
      body.scope === "this_and_following" ? "this_and_following" : "single";

    if (!lessonId) {
      throw new Error("lessonId e obrigatorio.");
    }

    if (!startsAt) {
      throw new Error("Escolha a nova data e hora da aula.");
    }

    const { data: lesson, error: lessonError } = await adminClient
      .from("scheduled_lessons")
      .select("*")
      .eq("id", lessonId)
      .maybeSingle();

    if (lessonError) {
      throw new Error(lessonError.message);
    }

    if (!lesson) {
      throw new Error("Agendamento nao encontrado.");
    }

    const canRescheduleAsAdmin = profile.role === "admin";
    const canRescheduleAsTeacher = profile.role === "professor" && lesson.teacher_id === user.id;
    const canRescheduleAsStudent = profile.role === "student" && lesson.student_id === user.id;

    if (!canRescheduleAsAdmin && !canRescheduleAsTeacher && !canRescheduleAsStudent) {
      throw new Error("Voce nao pode reagendar este agendamento.");
    }

    if (profile.role === "student" && scope !== "single") {
      throw new Error("Alunos podem reagendar apenas a aula selecionada.");
    }

    if (lesson.status !== "scheduled") {
      throw new Error("Somente aulas agendadas podem ser reagendadas.");
    }

    const nextBaseStart = new Date(startsAt);

    if (Number.isNaN(nextBaseStart.getTime())) {
      throw new Error("A nova data informada e invalida.");
    }

    const { data: settings, error: settingsError } = await adminClient
      .from("teacher_calendar_settings")
      .select("*")
      .eq("teacher_id", lesson.teacher_id)
      .maybeSingle();

    if (settingsError) {
      throw new Error(settingsError.message);
    }

    const selectedCalendarIds = Array.isArray(settings?.event_calendar_ids)
      ? settings.event_calendar_ids.filter(Boolean)
      : Array.isArray(settings?.sync_calendar_ids)
        ? settings.sync_calendar_ids.filter(Boolean)
        : settings?.calendar_id
          ? [settings.calendar_id]
          : [];
    const selectedCalendarId = selectedCalendarIds[0] || settings?.calendar_id || null;
    const timezone = settings?.timezone || "America/Bahia";
    const autoCreateMeet = settings?.auto_create_meet ?? true;
    const hasGoogleCalendar =
      Boolean(settings?.is_active) && settings?.connection_status === "connected";

    let lessonsToMove = [lesson];

    if (
      scope === "this_and_following" &&
      lesson.recurrence_group_id &&
      typeof lesson.recurrence_index === "number"
    ) {
      const { data: futureRecurringLessons, error: futureRecurringLessonsError } =
        await adminClient
          .from("scheduled_lessons")
          .select("*")
          .eq("recurrence_group_id", lesson.recurrence_group_id)
          .gte("recurrence_index", lesson.recurrence_index)
          .eq("status", "scheduled")
          .order("recurrence_index", { ascending: true });

      if (futureRecurringLessonsError) {
        throw new Error(futureRecurringLessonsError.message);
      }

      lessonsToMove = futureRecurringLessons?.length ? futureRecurringLessons : [lesson];
    }

    const targets: LessonTarget[] = lessonsToMove.map((item: any) => {
      const currentStart = new Date(item.starts_at);
      const currentEnd = new Date(item.ends_at);
      const durationMs = currentEnd.getTime() - currentStart.getTime();
      const weekOffset =
        scope === "this_and_following" &&
        typeof lesson.recurrence_index === "number" &&
        typeof item.recurrence_index === "number"
          ? item.recurrence_index - lesson.recurrence_index
          : 0;
      const targetStartsAt =
        weekOffset === 0
          ? nextBaseStart.toISOString()
          : addWeeks(nextBaseStart.toISOString(), weekOffset);
      const targetEndsAt = new Date(new Date(targetStartsAt).getTime() + durationMs).toISOString();

      return {
        lesson: item,
        startsAt: targetStartsAt,
        endsAt: targetEndsAt,
      };
    });

    const targetIds = new Set(targets.map((target) => target.lesson.id));
    const earliestStart = targets
      .map((target) => target.startsAt)
      .sort()[0];
    const latestEnd = targets
      .map((target) => target.endsAt)
      .sort()
      .at(-1) as string;

    const { data: existingLessons, error: existingLessonsError } = await adminClient
      .from("scheduled_lessons")
      .select("*")
      .eq("teacher_id", lesson.teacher_id)
      .lt("starts_at", latestEnd)
      .gt("ends_at", earliestStart);

    if (existingLessonsError) {
      throw new Error(existingLessonsError.message);
    }

    const internalConflicts = targets.find((target, index) =>
      targets.some(
        (otherTarget, otherIndex) =>
          index !== otherIndex &&
          target.startsAt < otherTarget.endsAt &&
          target.endsAt > otherTarget.startsAt,
      ),
    );

    if (internalConflicts) {
      throw new Error("Os novos horarios da recorrencia se sobrepoem entre si.");
    }

    const conflictingLesson = (existingLessons || []).find(
      (item: any) =>
        !targetIds.has(item.id) &&
        item.status !== "available" &&
        item.status !== "cancelled" &&
        targets.some((target) => overlapsWith(item, target.startsAt, target.endsAt)),
    );

    if (conflictingLesson) {
      throw new Error(
        `Ja existe um conflito em ${formatDateTime(conflictingLesson.starts_at, timezone)}.`,
      );
    }

    let tokenInfo:
      | {
          accessToken: string;
        }
      | null = null;
    let studentEmail: string | null = null;

    const requiresGoogleSync = targets.some(
      (target) =>
        (target.lesson.calendar_provider === "google_calendar" &&
          target.lesson.calendar_event_id &&
          target.lesson.calendar_calendar_id) ||
        hasGoogleCalendar,
    );

    if (requiresGoogleSync) {
      if (!selectedCalendarId && !targets.every((target) => target.lesson.calendar_calendar_id)) {
        throw new Error(
          "Selecione qual agenda do Google deseja usar antes de reagendar aulas sincronizadas.",
        );
      }

      tokenInfo = await ensureFreshGoogleAccessToken({
        adminClient,
        teacherId: lesson.teacher_id,
      });

      if (lesson.student_id) {
        try {
          studentEmail = await getStudentInviteEmail(adminClient, lesson.student_id);
        } catch (emailError) {
          console.warn(
            "Nao foi possivel resolver o e-mail do aluno para atualizar o convite automatico:",
            emailError instanceof Error ? emailError.message : emailError,
          );
        }
      }
    }

    const googleResultsByLessonId = new Map<
      string,
      {
        meetLink: string | null;
        calendarProvider: string | null;
        calendarCalendarId: string | null;
        calendarEventId: string | null;
      }
    >();

    for (const target of targets) {
      if (!tokenInfo) {
        googleResultsByLessonId.set(target.lesson.id, {
          meetLink: target.lesson.meet_link || null,
          calendarProvider: target.lesson.calendar_provider || null,
          calendarCalendarId: target.lesson.calendar_calendar_id || null,
          calendarEventId: target.lesson.calendar_event_id || null,
        });
        continue;
      }

      if (
        target.lesson.calendar_provider === "google_calendar" &&
        target.lesson.calendar_event_id &&
        target.lesson.calendar_calendar_id
      ) {
        const updatedEvent = await updateGoogleCalendarEvent({
          accessToken: tokenInfo.accessToken,
          calendarId: target.lesson.calendar_calendar_id,
          eventId: target.lesson.calendar_event_id,
          summary: target.lesson.title || "Aula agendada",
          description: target.lesson.description || null,
          startDateTime: target.startsAt,
          endDateTime: target.endsAt,
          timezone,
          attendeeEmails: studentEmail ? [studentEmail] : [],
        });

        googleResultsByLessonId.set(target.lesson.id, {
          meetLink: extractMeetLink(updatedEvent) || target.lesson.meet_link || null,
          calendarProvider: "google_calendar",
          calendarCalendarId: target.lesson.calendar_calendar_id,
          calendarEventId: target.lesson.calendar_event_id,
        });
        continue;
      }

      if (hasGoogleCalendar && selectedCalendarId) {
        const createdEvent = await createGoogleCalendarEvent({
          accessToken: tokenInfo.accessToken,
          calendarId: selectedCalendarId,
          summary: target.lesson.title || "Aula agendada",
          description: target.lesson.description || null,
          startDateTime: target.startsAt,
          endDateTime: target.endsAt,
          timezone,
          attendeeEmails: studentEmail ? [studentEmail] : [],
          autoCreateMeet,
        });

        googleResultsByLessonId.set(target.lesson.id, {
          meetLink: extractMeetLink(createdEvent) || target.lesson.meet_link || null,
          calendarProvider: typeof createdEvent?.id === "string" ? "google_calendar" : null,
          calendarCalendarId:
            typeof createdEvent?.id === "string" ? selectedCalendarId : null,
          calendarEventId:
            typeof createdEvent?.id === "string" ? createdEvent.id : null,
        });
        continue;
      }

      googleResultsByLessonId.set(target.lesson.id, {
        meetLink: target.lesson.meet_link || null,
        calendarProvider: target.lesson.calendar_provider || null,
        calendarCalendarId: target.lesson.calendar_calendar_id || null,
        calendarEventId: target.lesson.calendar_event_id || null,
      });
    }

    const updatedLessons: any[] = [];

    for (const target of targets) {
      const googleResult = googleResultsByLessonId.get(target.lesson.id);

      const { data: updatedLesson, error: updateError } = await adminClient
        .from("scheduled_lessons")
        .update({
          starts_at: target.startsAt,
          ends_at: target.endsAt,
          meet_link: googleResult?.meetLink || target.lesson.meet_link || null,
          calendar_provider:
            googleResult?.calendarProvider ?? target.lesson.calendar_provider ?? null,
          calendar_calendar_id:
            googleResult?.calendarCalendarId ??
            target.lesson.calendar_calendar_id ??
            null,
          calendar_event_id:
            googleResult?.calendarEventId ?? target.lesson.calendar_event_id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", target.lesson.id)
        .select("*")
        .maybeSingle();

      if (updateError) {
        throw new Error(updateError.message);
      }

      if (updatedLesson) {
        updatedLessons.push(updatedLesson);
      }
    }

    return new Response(
      JSON.stringify({
        lesson: updatedLessons.find((item) => item.id === lessonId) || updatedLessons[0] || null,
        lessons: updatedLessons,
        rescheduleScope: scope,
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
