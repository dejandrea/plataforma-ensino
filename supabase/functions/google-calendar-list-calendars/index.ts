import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  ensureFreshGoogleAccessToken,
  getGoogleCalendarList,
} from "../_shared/google-calendar.ts";
import { getAuthenticatedProfile } from "../_shared/supabase.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const { adminClient, user, profile } = await getAuthenticatedProfile(req);

    if (!["admin", "professor"].includes(profile.role)) {
      throw new Error("Apenas professoras e admins podem listar agendas do Google.");
    }

    const tokenInfo = await ensureFreshGoogleAccessToken({
      adminClient,
      teacherId: user.id,
    });

    const calendars = await getGoogleCalendarList({
      accessToken: tokenInfo.accessToken,
    });

    const visibleCalendars = calendars
      .filter((calendar: any) => typeof calendar?.id === "string" && calendar?.summary)
      .map((calendar: any) => ({
        id: calendar.id,
        summary: calendar.summary,
        primary: Boolean(calendar.primary),
        accessRole: calendar.accessRole || null,
      }));

    return new Response(JSON.stringify({ calendars: visibleCalendars }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
