import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getAuthenticatedProfile } from "../_shared/supabase.ts";

type CreatePlatformUserPayload = {
  email?: string;
  fullName?: string;
  lastName?: string | null;
  nickname?: string | null;
  birthDate?: string | null;
  role?: "student" | "professor" | "admin";
  redirectTo?: string;
};

const ALLOWED_ROLES = new Set(["student", "professor", "admin"]);

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const attachInviteToUser = async ({
  adminClient,
  email,
  userId,
}: {
  adminClient: any;
  email: string;
  userId: string;
}) => {
  const { error } = await adminClient
    .from("access_invites")
    .update({
      claimed_user_id: userId,
    })
    .ilike("email", email);

  if (error) {
    throw new Error(error.message);
  }
};

const upsertProfile = async ({
  adminClient,
  userId,
  fullName,
  lastName,
  nickname,
  birthDate,
  role,
}: {
  adminClient: any;
  userId: string;
  fullName: string;
  lastName: string | null;
  nickname: string | null;
  birthDate: string | null;
  role: string;
}) => {
  const { error } = await adminClient.from("profiles").upsert({
    id: userId,
    full_name: fullName,
    last_name: lastName,
    nickname,
    birth_date: birthDate,
    role,
    is_active: true,
    invited_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }
};

const findAuthUserByEmail = async (adminClient: any, email: string) => {
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(error.message);
    }

    const matchingUser = data.users.find(
      (user: any) => String(user.email || "").toLowerCase() === email,
    );

    if (matchingUser) {
      return matchingUser;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const { adminClient, profile } = await getAuthenticatedProfile(req);

    if (profile.role !== "admin") {
      throw new Error("Apenas administradores podem cadastrar usuarios.");
    }

    const payload = (await req.json()) as CreatePlatformUserPayload;
    const email = normalizeEmail(payload.email || "");
    const fullName = String(payload.fullName || "").trim();
    const lastName = payload.lastName?.trim() || null;
    const nickname = payload.nickname?.trim() || null;
    const birthDate = payload.birthDate || null;
    const role = String(payload.role || "student");
    const redirectTo = String(payload.redirectTo || "").trim();

    if (!email) {
      throw new Error("O e-mail do usuario e obrigatorio.");
    }

    if (!fullName) {
      throw new Error("O nome completo do usuario e obrigatorio.");
    }

    if (!ALLOWED_ROLES.has(role)) {
      throw new Error("O cargo informado e invalido.");
    }

    if (!redirectTo) {
      throw new Error("redirectTo e obrigatorio para definir a senha inicial.");
    }

    const { data: existingInvite, error: inviteLookupError } = await adminClient
      .from("access_invites")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (inviteLookupError) {
      throw new Error(inviteLookupError.message);
    }

    if (existingInvite?.id) {
      const { error: updateInviteError } = await adminClient
        .from("access_invites")
        .update({
          email,
          full_name: fullName,
          last_name: lastName,
          nickname,
          birth_date: birthDate,
          role,
        })
        .eq("id", existingInvite.id);

      if (updateInviteError) {
        throw new Error(updateInviteError.message);
      }
    } else {
      const { error: insertInviteError } = await adminClient
        .from("access_invites")
        .insert({
          email,
          full_name: fullName,
          last_name: lastName,
          nickname,
          birth_date: birthDate,
          role,
        });

      if (insertInviteError) {
        throw new Error(insertInviteError.message);
      }
    }

    const authUser = await findAuthUserByEmail(adminClient, email);

    if (!authUser) {
      const { data: inviteUserData, error: inviteUserError } = await adminClient.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo,
          data: {
            full_name: fullName,
            role,
          },
        },
      );

      if (inviteUserError) {
        throw new Error(inviteUserError.message);
      }

      const invitedUserId = inviteUserData?.user?.id;
      if (invitedUserId) {
        await attachInviteToUser({
          adminClient,
          email,
          userId: invitedUserId,
        });

        await upsertProfile({
          adminClient,
          userId: invitedUserId,
          fullName,
          lastName,
          nickname,
          birthDate,
          role,
        });
      }

      return new Response(
        JSON.stringify({
          message:
            "Usuario cadastrado com sucesso. O convite para definir a senha foi enviado por e-mail.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    await attachInviteToUser({
      adminClient,
      email,
      userId: authUser.id,
    });

    await upsertProfile({
      adminClient,
      userId: authUser.id,
      fullName,
      lastName,
      nickname,
      birthDate,
      role,
    });

    const { error: resetPasswordError } = await adminClient.auth.resetPasswordForEmail(
      email,
      {
        redirectTo,
      },
    );

    if (resetPasswordError) {
      throw new Error(resetPasswordError.message);
    }

    return new Response(
      JSON.stringify({
        message:
          "Usuario atualizado com sucesso. Enviamos um novo link para definir ou redefinir a senha.",
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
