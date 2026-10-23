import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  ensureFreshGoogleAccessToken,
  extractMeetLink,
  getGoogleCalendarEvents,
  getGoogleCalendarEvent,
} from "../_shared/google-calendar.ts";
import { getAuthenticatedProfile } from "../_shared/supabase.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const { adminClient, user, profile } = await getAuthenticatedProfile(req);
    const body = await req.json().catch(() => ({}));

    if (!["admin", "professor", "student"].includes(profile.role)) {
      throw new Error("Perfil sem permissao para sincronizar o Google Calendar.");
    }

    let teacherId = user.id;

    if (profile.role === "admin" && typeof body?.teacherId === "string") {
      teacherId = body.teacherId;
    } else if (profile.role === "professor") {
      teacherId = user.id;
    } else if (profile.role === "student") {
      if (typeof body?.teacherId !== "string" || !body.teacherId) {
        throw new Error("teacherId e obrigatorio para sincronizar via painel do aluno.");
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

    if (!settings || !settings.is_active) {
      throw new Error("Nenhuma configuracao ativa de Google Agenda foi encontrada.");
    }

    const selectedCalendarIds = Array.isArray(settings.event_calendar_ids)
      ? settings.event_calendar_ids.filter(Boolean)
      : Array.isArray(settings.sync_calendar_ids)
        ? settings.sync_calendar_ids.filter(Boolean)
      : settings.calendar_id
        ? [settings.calendar_id]
        : [];

    if (selectedCalendarIds.length === 0) {
      throw new Error("Selecione pelo menos uma agenda do Google para sincronizar.");
    }

    const tokenInfo = await ensureFreshGoogleAccessToken({
      adminClient,
      teacherId,
    });

    const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

    const googleEventsByCalendar = await Promise.all(
      selectedCalendarIds.map(async (calendarId: string) => {
        const items = await getGoogleCalendarEvents({
          accessToken: tokenInfo.accessToken,
          calendarId,
          timeMin,
          timeMax,
        });

        return items.map((event: any) => ({
          ...event,
          __calendar_id: calendarId,
        }));
      }),
    );

    const googleEvents = googleEventsByCalendar.flat();

    // Deleted events may contain only an ID. Handle them before filtering
    // importable lessons, preserving the existing lesson and its student.
    const { data: existingLessons, error: existingError } = await adminClient
      .from("scheduled_lessons")
      .select("id, student_id, calendar_calendar_id, calendar_event_id")
      .eq("teacher_id", teacherId)
      .eq("calendar_provider", "google_calendar")
      .in("calendar_calendar_id", selectedCalendarIds)
      .neq("status", "cancelled")
      .gt("ends_at", timeMin)
      .lt("starts_at", timeMax);
    if (existingError) throw new Error(existingError.message);

    const eventsByCalendar = new Map<string, Map<string, any>>();
    for (const event of googleEvents) {
      if (!eventsByCalendar.has(event.__calendar_id)) {
        eventsByCalendar.set(event.__calendar_id, new Map());
      }
      eventsByCalendar.get(event.__calendar_id)!.set(event.id, event);
    }
    const cancelledLessonIds: string[] = [];
    for (const lesson of existingLessons || []) {
      if (!lesson.calendar_event_id) continue;
      const event = eventsByCalendar.get(lesson.calendar_calendar_id)?.get(lesson.calendar_event_id)
        || await getGoogleCalendarEvent({
          accessToken: tokenInfo.accessToken,
          calendarId: lesson.calendar_calendar_id,
          eventId: lesson.calendar_event_id,
          allowMissing: true,
        });
      if (event.status === "cancelled") cancelledLessonIds.push(lesson.id);
    }

    const relevantEvents = googleEvents.filter((event: any) => {
      if (event.status === "cancelled") return false;
      if (!event?.start?.dateTime || !event?.end?.dateTime) return false;

      const attendeeEmails = Array.isArray(event.attendees)
        ? event.attendees
            .map((attendee: any) => attendee?.email?.toLowerCase?.())
            .filter(Boolean)
        : [];
      const meetLink = extractMeetLink(event);

      return attendeeEmails.length > 0 || Boolean(meetLink);
    });

    const attendeeEmails = Array.from(
      new Set(
        relevantEvents.flatMap((event: any) =>
          Array.isArray(event.attendees)
            ? event.attendees
                .map((attendee: any) => attendee?.email?.toLowerCase?.())
                .filter(Boolean)
            : [],
        ),
      ),
    );

    const { data: invites, error: invitesError } = attendeeEmails.length
      ? await adminClient
          .from("access_invites")
          .select("email, claimed_user_id, role")
          .in("email", attendeeEmails)
      : { data: [], error: null };

    if (invitesError) {
      throw new Error(invitesError.message);
    }

    const studentIdsFromEmails = (invites || [])
      .filter((invite: any) => invite.role === "student" && invite.claimed_user_id)
      .map((invite: any) => invite.claimed_user_id);

    const { data: relations, error: relationsError } = studentIdsFromEmails.length
      ? await adminClient
          .from("teacher_student_relations")
          .select("student_id")
          .eq("teacher_id", teacherId)
          .in("student_id", studentIdsFromEmails)
      : { data: [], error: null };

    if (relationsError) {
      throw new Error(relationsError.message);
    }

    const allowedStudentIds = new Set((relations || []).map((relation: any) => relation.student_id));
    const inviteMap = new Map(
      (invites || [])
        .filter((invite: any) => invite.role === "student" && invite.claimed_user_id)
        .map((invite: any) => [String(invite.email).toLowerCase(), invite.claimed_user_id]),
    );

    const rowsToUpsert = relevantEvents.map((event: any) => {
      const attendeeList = Array.isArray(event.attendees) ? event.attendees : [];
      const matchedStudentId =
        attendeeList
          .map((attendee: any) => attendee?.email?.toLowerCase?.())
          .map((email: string | undefined) =>
            email && allowedStudentIds.has(inviteMap.get(email))
              ? inviteMap.get(email)
              : null,
          )
          .find(Boolean) || (existingLessons || []).find((lesson: any) =>
            lesson.calendar_calendar_id === event.__calendar_id && lesson.calendar_event_id === event.id,
          )?.student_id || null;

      const startsAt = event.start.dateTime;
      const endsAt = event.end.dateTime;
      const hasEnded = new Date(endsAt).getTime() < Date.now();
      if (hasEnded && !matchedStudentId) return null;
      const googleStatus = !matchedStudentId ? "available" : hasEnded ? "completed" : "scheduled";

      return {
        teacher_id: teacherId,
        student_id: matchedStudentId,
        created_by: teacherId,
        title: event.summary || "Aula sincronizada do Google",
        description: event.description || null,
        session_track: "mentoring",
        status: googleStatus,
        starts_at: startsAt,
        ends_at: endsAt,
        meet_link: extractMeetLink(event),
        calendar_provider: "google_calendar",
        calendar_calendar_id: event.__calendar_id,
        calendar_event_id: event.id,
        booked_at: matchedStudentId ? event.created || new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };
    }).filter(Boolean);

    const { error: cleanupError } = await adminClient
      .from("scheduled_lessons")
      .delete()
      .eq("teacher_id", teacherId)
      .eq("calendar_provider", "google_calendar")
      .not("calendar_event_id", "is", null)
      .not("calendar_calendar_id", "in", `(${selectedCalendarIds.map((id: string) => `"${id}"`).join(",")})`);

    if (cleanupError) {
      throw new Error(cleanupError.message);
    }

    if (rowsToUpsert.length > 0) {
      const { error: upsertError } = await adminClient.rpc("import_google_calendar_lessons", {
        p_teacher_id: teacherId,
        p_lessons: rowsToUpsert,
      });

      if (upsertError) {
        throw new Error(upsertError.message);
      }
    }

    for (let offset = 0; offset < cancelledLessonIds.length; offset += 100) {
      const { error: cancelError } = await adminClient
        .from("scheduled_lessons")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("teacher_id", teacherId)
        .eq("calendar_provider", "google_calendar")
        .in("id", cancelledLessonIds.slice(offset, offset + 100));
      if (cancelError) throw new Error(cancelError.message);
    }

    const { error: updateSettingsError } = await adminClient
      .from("teacher_calendar_settings")
      .update({
        connection_status: "connected",
        last_synced_at: new Date().toISOString(),
        last_sync_error: null,
        provider_account_email:
          settings.provider_account_email || tokenInfo.providerAccountEmail || null,
        calendar_name: settings.calendar_name || null,
        updated_at: new Date().toISOString(),
      })
      .eq("teacher_id", teacherId);

    if (updateSettingsError) {
      throw new Error(updateSettingsError.message);
    }

    return new Response(
      JSON.stringify({
        synced: true,
        importedEvents: rowsToUpsert.length,
        cancelledEvents: cancelledLessonIds.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    try {
      const { adminClient, user } = await getAuthenticatedProfile(req);
      await adminClient
        .from("teacher_calendar_settings")
        .update({
          connection_status: "error",
          last_sync_error:
            error instanceof Error ? error.message : "Erro desconhecido.",
          updated_at: new Date().toISOString(),
        })
        .eq("teacher_id", user.id);
    } catch {
      // noop
    }

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
