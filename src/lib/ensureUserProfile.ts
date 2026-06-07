import { supabase } from "./supabaseClient";

type UserProfile = {
  role: string;
  is_active: boolean;
  student_service_scope?: "mentoring" | "course" | "both" | null;
};

export const ensureUserProfile = async (
  userId: string,
  email?: string | null,
): Promise<UserProfile | null> => {
  let existingProfile = await supabase
    .from("profiles")
    .select("role, is_active, student_service_scope")
    .eq("id", userId)
    .maybeSingle();

  if (existingProfile.error?.message?.includes("student_service_scope")) {
    existingProfile = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", userId)
      .maybeSingle();
  }

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

  let claimedProfile = await supabase
    .from("profiles")
    .select("role, is_active, student_service_scope")
    .eq("id", userId)
    .maybeSingle();

  if (claimedProfile.error?.message?.includes("student_service_scope")) {
    claimedProfile = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", userId)
      .maybeSingle();
  }

  return (claimedProfile.data as UserProfile | null) || null;
};
