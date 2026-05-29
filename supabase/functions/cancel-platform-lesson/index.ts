import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  deleteGoogleCalendarEvent,
  ensureFreshGoogleAccessToken,
} from "../_shared/google-calendar.ts";
import { getAuthenticatedProfile } from "../_shared/supabase.ts";

type CancellationScope = "single" | "this_and_following";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const { adminClient, user, profile } = await getAuthenticatedProfile(req);

    if (
      profile.role !== "professor" &&
      profile.role !== "admin" &&
      profile.role !== "student"
    ) {
      throw new Error("Voce nao tem permissao para cancelar agendamentos.");
    }

    const body = await req.json().catch(() => ({}));
    const lessonId = typeof body?.lessonId === "string" ? body.lessonId : "";
    const scope: CancellationScope =
      body?.scope === "this_and_following" ? "this_and_following" : "single";

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

    if (!lesson) {
      throw new Error("Agendamento nao encontrado.");
    }

    const canCancelAsAdmin = profile.role === "admin";
    const canCancelAsTeacher = profile.role === "professor" && lesson.teacher_id === user.id;
    const canCancelAsStudent = profile.role === "student" && lesson.student_id === user.id;

    if (!canCancelAsAdmin && !canCancelAsTeacher && !canCancelAsStudent) {
      throw new Error("Voce nao pode cancelar este agendamento.");
    }

    if (lesson.status === "cancelled") {
      return new Response(
        JSON.stringify({
          lesson,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let lessonsToCancel = [lesson];

    if (
      scope === "this_and_following" &&
      lesson.recurrence_group_id &&
      typeof lesson.recurrence_index === "number"
    ) {
      const { data: recurringLessons, error: recurringLessonsError } = await adminClient
        .from("scheduled_lessons")
        .select("*")
        .eq("recurrence_group_id", lesson.recurrence_group_id)
        .gte("recurrence_index", lesson.recurrence_index)
        .order("recurrence_index", { ascending: true });

      if (recurringLessonsError) {
        throw new Error(recurringLessonsError.message);
      }

      lessonsToCancel = (recurringLessons || []).filter(
        (item: any) => item.status !== "cancelled" && item.status !== "completed",
      );
    }

    if (lessonsToCancel.length === 0) {
      return new Response(
        JSON.stringify({
          lesson,
          lessons: [],
          cancelledCount: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const tokenInfo = lessonsToCancel.some(
      (item: any) =>
        item.calendar_provider === "google_calendar" &&
        item.calendar_event_id &&
        item.calendar_calendar_id,
    )
      ? await ensureFreshGoogleAccessToken({
          adminClient,
          teacherId: lesson.teacher_id,
        })
      : null;

    for (const item of lessonsToCancel) {
      if (
        tokenInfo &&
        item.calendar_provider === "google_calendar" &&
        item.calendar_event_id &&
        item.calendar_calendar_id
      ) {
        await deleteGoogleCalendarEvent({
          accessToken: tokenInfo.accessToken,
          calendarId: item.calendar_calendar_id,
          eventId: item.calendar_event_id,
        });
      }
    }

    const lessonIds = lessonsToCancel.map((item: any) => item.id);
    const cancellationTimestamp = new Date().toISOString();

    const { data: updatedLessons, error: updateError } = await adminClient
      .from("scheduled_lessons")
      .update({
        status: "cancelled",
        cancelled_at: cancellationTimestamp,
        updated_at: cancellationTimestamp,
      })
      .in("id", lessonIds)
      .select("*");

    if (updateError) {
      throw new Error(updateError.message);
    }

    if (!updatedLessons?.length) {
      throw new Error("Nao foi possivel atualizar o agendamento cancelado.");
    }

    const primaryUpdatedLesson =
      updatedLessons.find((item: any) => item.id === lessonId) || updatedLessons[0];

    return new Response(
      JSON.stringify({
        lesson: primaryUpdatedLesson,
        lessons: updatedLessons,
        cancelledCount: updatedLessons.length,
        cancellationScope: scope,
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
