import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getAuthenticatedProfile } from "../_shared/supabase.ts";

type UpdatePlatformUserPayload = {
  inviteId?: string | null;
  userId?: string | null;
  email?: string | null;
  fullName?: string;
  lastName?: string | null;
  nickname?: string | null;
  birthDate?: string | null;
  role?: "student" | "professor" | "admin";
  isActive?: boolean | null;
};

const ALLOWED_ROLES = new Set(["student", "professor", "admin"]);

const normalizeEmail = (value: string) => value.trim().toLowerCase();

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const { adminClient, profile } = await getAuthenticatedProfile(req);

    if (profile.role !== "admin") {
      throw new Error("Apenas administradores podem editar usuarios.");
    }

    const payload = (await req.json()) as UpdatePlatformUserPayload;
    const inviteId = payload.inviteId || null;
    const userId = payload.userId || null;
    const email = normalizeEmail(payload.email || "");
    const fullName = String(payload.fullName || "").trim();
    const lastName = payload.lastName?.trim() || null;
    const nickname = payload.nickname?.trim() || null;
    const birthDate = payload.birthDate || null;
    const role = String(payload.role || "student");
    const isActive = payload.isActive ?? true;
    let existingInvite:
      | { claimed_at: string | null; claimed_user_id: string | null }
      | null = null;

    if (!email) {
      throw new Error("O e-mail do usuario e obrigatorio.");
    }

    if (!fullName) {
      throw new Error("O nome completo do usuario e obrigatorio.");
    }

    if (!ALLOWED_ROLES.has(role)) {
      throw new Error("O cargo informado e invalido.");
    }

    if (!inviteId && !userId) {
      throw new Error("E necessario informar o convite ou o usuario para editar.");
    }

    if (inviteId) {
      const { data: inviteData, error: inviteLookupError } = await adminClient
        .from("access_invites")
        .select("claimed_at, claimed_user_id")
        .eq("id", inviteId)
        .maybeSingle();

      if (inviteLookupError) {
        throw new Error(inviteLookupError.message);
      }

      existingInvite = inviteData;
    }

    if (userId) {
      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(
        userId,
        {
          email,
          user_metadata: {
            full_name: fullName,
            role,
          },
        },
      );

      if (authUpdateError) {
        throw new Error(authUpdateError.message);
      }

      const { error: profileUpdateError } = await adminClient
        .from("profiles")
        .update({
          full_name: fullName,
          last_name: lastName,
          nickname,
          birth_date: birthDate,
          role,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (profileUpdateError) {
        throw new Error(profileUpdateError.message);
      }
    }

    if (inviteId) {
      const { error: inviteUpdateError } = await adminClient
        .from("access_invites")
        .update({
          email,
          full_name: fullName,
          last_name: lastName,
          nickname,
          birth_date: birthDate,
          role,
          claimed_user_id: userId,
          claimed_at: userId
            ? existingInvite?.claimed_at || new Date().toISOString()
            : null,
        })
        .eq("id", inviteId);

      if (inviteUpdateError) {
        throw new Error(inviteUpdateError.message);
      }
    } else if (userId) {
      const { error: inviteInsertError } = await adminClient
        .from("access_invites")
        .insert({
          email,
          full_name: fullName,
          last_name: lastName,
          nickname,
          birth_date: birthDate,
          role,
          invited_at: new Date().toISOString(),
          claimed_at: new Date().toISOString(),
          claimed_user_id: userId,
        });

      if (inviteInsertError) {
        throw new Error(inviteInsertError.message);
      }
    }

    return new Response(
      JSON.stringify({
        message: userId
          ? "Usuario atualizado com sucesso."
          : "Convite atualizado com sucesso.",
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
