import { supabase } from "./supabaseClient";

type UserProfile = {
  role: string;
  is_active: boolean;
};

export const ensureUserProfile = async (
  userId: string,
  email?: string | null,
): Promise<UserProfile | null> => {
  const existingProfile = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (existingProfile.data) {
    return existingProfile.data as UserProfile;
  }

  if (!email) {
    return null;
  }

  const { error: claimError } = await supabase.rpc("claim_access_invite", {
    p_email: email,
    p_user_id: userId,
  });

  if (claimError) {
    console.error("Erro ao vincular convite ao perfil:", claimError);
    return null;
  }

  const claimedProfile = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", userId)
    .maybeSingle();

  return (claimedProfile.data as UserProfile | null) || null;
};
