import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  exchangeGoogleCode,
  getGoogleUserEmail,
} from "../_shared/google-calendar.ts";
import { getAuthenticatedProfile } from "../_shared/supabase.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const { adminClient, user, profile } = await getAuthenticatedProfile(req);

    if (!["admin", "professor"].includes(profile.role)) {
      throw new Error("Apenas professoras e admins podem concluir a conexao do Google Calendar.");
    }

    const { code, state, redirectTo } = await req.json();
    if (!code || !state || !redirectTo) {
      throw new Error("code, state e redirectTo sao obrigatorios.");
    }

    const { data: tokenRow, error: tokenRowError } = await adminClient
      .from("teacher_google_calendar_tokens")
      .select("*")
      .eq("teacher_id", user.id)
      .eq("oauth_state", state)
      .maybeSingle();

    if (tokenRowError) {
      throw new Error(tokenRowError.message);
    }

    if (!tokenRow) {
      throw new Error("Estado OAuth invalido ou expirado.");
    }

    const tokens = await exchangeGoogleCode({
      code,
      redirectTo,
    });

    const providerAccountEmail = await getGoogleUserEmail(tokens.access_token);
    const refreshToken = tokens.refresh_token || tokenRow.refresh_token || null;
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

    const { error: saveTokenError } = await adminClient
      .from("teacher_google_calendar_tokens")
      .upsert({
        teacher_id: user.id,
        provider_account_email: providerAccountEmail || tokenRow.provider_account_email || null,
        access_token: tokens.access_token,
        refresh_token: refreshToken,
        token_type: tokens.token_type || null,
        scope: tokens.scope || null,
        expires_at: expiresAt,
        oauth_state: null,
        updated_at: new Date().toISOString(),
      });

    if (saveTokenError) {
      throw new Error(saveTokenError.message);
    }

    const { error: settingsError } = await adminClient
      .from("teacher_calendar_settings")
      .upsert({
        teacher_id: user.id,
        provider: "google_calendar",
        provider_account_email:
          providerAccountEmail || tokenRow.provider_account_email || null,
        calendar_id: null,
        calendar_name: null,
        sync_calendar_ids: [],
        sync_calendar_names: [],
        event_calendar_ids: [],
        event_calendar_names: [],
        availability_calendar_ids: [],
        availability_calendar_names: [],
        connection_status: "connected",
        last_sync_error: null,
        updated_at: new Date().toISOString(),
      });

    if (settingsError) {
      throw new Error(settingsError.message);
    }

    return new Response(
      JSON.stringify({
        connected: true,
        providerAccountEmail,
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
