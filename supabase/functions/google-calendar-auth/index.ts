import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { buildGoogleAuthUrl } from "../_shared/google-calendar.ts";
import { getAuthenticatedProfile } from "../_shared/supabase.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const { adminClient, user, profile } = await getAuthenticatedProfile(req);

    if (!["admin", "professor"].includes(profile.role)) {
      throw new Error("Apenas professoras e admins podem conectar o Google Calendar.");
    }

    const { redirectTo } = await req.json();
    if (!redirectTo || typeof redirectTo !== "string") {
      throw new Error("redirectTo e obrigatorio para iniciar o OAuth do Google.");
    }

    const state = crypto.randomUUID();

    const { error: tokenError } = await adminClient
      .from("teacher_google_calendar_tokens")
      .upsert({
        teacher_id: user.id,
        oauth_state: state,
        updated_at: new Date().toISOString(),
      });

    if (tokenError) {
      throw new Error(tokenError.message);
    }

    const { error: settingsError } = await adminClient
      .from("teacher_calendar_settings")
      .upsert({
        teacher_id: user.id,
        provider: "google_calendar",
        connection_status: "pending",
        last_sync_error: null,
        updated_at: new Date().toISOString(),
      });

    if (settingsError) {
      throw new Error(settingsError.message);
    }

    const authUrl = buildGoogleAuthUrl({
      redirectTo,
      state,
    });

    return new Response(JSON.stringify({ authUrl }), {
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
