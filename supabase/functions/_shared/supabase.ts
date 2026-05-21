import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

const fallbackAnonKey = (() => {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed.default as string;
  } catch {
    return null;
  }
})();

const fallbackServiceKey = (() => {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed.default as string;
  } catch {
    return null;
  }
})();

export const supabaseAnonKey =
  Deno.env.get("SUPABASE_ANON_KEY") || fallbackAnonKey || "";
export const supabaseServiceRoleKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || fallbackServiceKey || "";

export const createUserClient = (req: Request) =>
  createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") || "",
      },
    },
  });

export const createAdminClient = () =>
  createClient(supabaseUrl, supabaseServiceRoleKey);

export const getAuthenticatedProfile = async (req: Request) => {
  const userClient = createUserClient(req);
  const adminClient = createAdminClient();

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    throw new Error("Usuario nao autenticado.");
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("Perfil nao encontrado.");
  }

  return {
    adminClient,
    user,
    profile,
  };
};
