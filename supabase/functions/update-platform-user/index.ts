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
  hourlyRate?: number | string | null;
  pricingMode?: "rate" | "package" | "legacy" | null;
  pricingSessionTrack?: "mentoring" | "course" | null;
  pricingPackageId?: string | null;
  studentServiceScope?: "mentoring" | "course" | "both" | null;
  studentCommercialAssignments?: Array<{
    sessionTrack?: "mentoring" | "course" | null;
    pricingMode?: "rate" | "package" | "legacy" | null;
    pricingPackageId?: string | null;
  }> | null;
  isActive?: boolean | null;
};

const ALLOWED_ROLES = new Set(["student", "professor", "admin"]);
const ALLOWED_SESSION_TRACKS = new Set(["mentoring", "course"]);
const ALLOWED_SERVICE_SCOPES = new Set(["mentoring", "course", "both"]);

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const parseHourlyRate = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue =
    typeof value === "number"
      ? value
      : Number.parseFloat(String(value).replace(",", ".").trim());

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new Error("O valor de hora/aula informado e invalido.");
  }

  return Number(numericValue.toFixed(2));
};

const computePackageHourlyRate = (packagePrice: number, lessonQuantity: number) => {
  if (!Number.isFinite(packagePrice) || packagePrice < 0) {
    throw new Error("O preco do pacote informado e invalido.");
  }

  if (!Number.isFinite(lessonQuantity) || lessonQuantity <= 0) {
    throw new Error("A quantidade de aulas do pacote precisa ser maior que zero.");
  }

  return Number((packagePrice / lessonQuantity).toFixed(2));
};

type ResolvedStudentAssignment = {
  sessionTrack: "mentoring" | "course";
  pricingMode: "rate" | "package";
  pricingPackageId: string | null;
  hourlyRate: number | null;
};

const getTracksFromScope = (scope: string | null) => {
  if (scope === "both") {
    return ["mentoring", "course"] as const;
  }

  if (scope === "course") {
    return ["course"] as const;
  }

  return ["mentoring"] as const;
};

const getCommercialTracksFromScope = (scope: string | null) => {
  if (scope === "course") {
    return ["course"] as const;
  }

  return ["mentoring"] as const;
};

const normalizeStudentAssignments = (payload: {
  pricingMode: "rate" | "package" | "legacy" | null;
  pricingSessionTrack: string | null;
  pricingPackageId: string | null;
  studentServiceScope: string | null;
  studentCommercialAssignments:
    | Array<{
        sessionTrack?: "mentoring" | "course" | null;
        pricingMode?: "rate" | "package" | "legacy" | null;
        pricingPackageId?: string | null;
      }>
    | null
    | undefined;
}) => {
  const assignments = (payload.studentCommercialAssignments || [])
    .map((item) => ({
      sessionTrack:
        item?.sessionTrack === "course" || item?.sessionTrack === "mentoring"
          ? item.sessionTrack
          : null,
      pricingMode:
        item?.pricingMode === "rate" || item?.pricingMode === "package"
          ? item.pricingMode
          : null,
      pricingPackageId: item?.pricingPackageId?.trim() || null,
    }))
    .filter((item) => item.sessionTrack && item.pricingMode) as Array<{
    sessionTrack: "mentoring" | "course";
    pricingMode: "rate" | "package";
    pricingPackageId: string | null;
  }>;

  if (assignments.length > 0) {
    const normalizedScope =
      payload.studentServiceScope && ALLOWED_SERVICE_SCOPES.has(payload.studentServiceScope)
        ? payload.studentServiceScope
        : assignments.length > 1
          ? "both"
          : assignments[0].sessionTrack;

    return {
      serviceScope: normalizedScope,
      assignments,
    };
  }

  if (
    (payload.pricingMode === "rate" || payload.pricingMode === "package") &&
    payload.pricingSessionTrack &&
    ALLOWED_SESSION_TRACKS.has(payload.pricingSessionTrack)
  ) {
    return {
      serviceScope:
        payload.studentServiceScope && ALLOWED_SERVICE_SCOPES.has(payload.studentServiceScope)
          ? payload.studentServiceScope
          : payload.pricingSessionTrack,
      assignments: [
        {
          sessionTrack: payload.pricingSessionTrack as "mentoring" | "course",
          pricingMode: payload.pricingMode,
          pricingPackageId: payload.pricingPackageId,
        },
      ],
    };
  }

  return {
    serviceScope:
      payload.studentServiceScope && ALLOWED_SERVICE_SCOPES.has(payload.studentServiceScope)
        ? payload.studentServiceScope
        : null,
    assignments: [],
  };
};

const resolveStudentPricing = async ({
  adminClient,
  role,
  hourlyRate,
  pricingMode,
  pricingSessionTrack,
  pricingPackageId,
  studentServiceScope,
  studentCommercialAssignments,
}: {
  adminClient: any;
  role: string;
  hourlyRate: number | null;
  pricingMode: "rate" | "package" | "legacy" | null;
  pricingSessionTrack: string | null;
  pricingPackageId: string | null;
  studentServiceScope: string | null;
  studentCommercialAssignments:
    | Array<{
        sessionTrack?: "mentoring" | "course" | null;
        pricingMode?: "rate" | "package" | "legacy" | null;
        pricingPackageId?: string | null;
      }>
    | null
    | undefined;
}) => {
  if (role !== "student") {
    return {
      hourlyRate: null,
      pricingMode: null,
      pricingSessionTrack: null,
      pricingPackageId: null,
      studentServiceScope: null,
      commercialAssignments: [],
    };
  }

  const normalized = normalizeStudentAssignments({
    pricingMode,
    pricingSessionTrack,
    pricingPackageId,
    studentServiceScope,
    studentCommercialAssignments,
  });

  if (!normalized.serviceScope || !ALLOWED_SERVICE_SCOPES.has(normalized.serviceScope)) {
    throw new Error("Selecione se o aluno faz mentoria, curso ou ambos.");
  }

  const requiredTracks = new Set(getCommercialTracksFromScope(normalized.serviceScope));
  const resolvedAssignments: ResolvedStudentAssignment[] = [];

  for (const sessionTrack of requiredTracks) {
    const assignment = normalized.assignments.find((item) => item.sessionTrack === sessionTrack);

    if (!assignment) {
      throw new Error(
        sessionTrack === "course"
          ? "Configure o preco ou pacote de Curso para o aluno."
          : "Configure o preco ou pacote de Mentoria para o aluno.",
      );
    }

    if (assignment.pricingMode === "package") {
      if (!assignment.pricingPackageId) {
        throw new Error("Selecione um pacote para o aluno.");
      }

      const { data: selectedPackage, error: packageError } = await adminClient
        .from("commercial_packages")
        .select("id, session_track, lesson_quantity, package_price")
        .eq("id", assignment.pricingPackageId)
        .maybeSingle();

      if (packageError) {
        throw new Error(packageError.message);
      }

      if (!selectedPackage?.id) {
        throw new Error("O pacote selecionado nao foi encontrado.");
      }

      if (selectedPackage.session_track !== sessionTrack) {
        throw new Error("O pacote selecionado nao corresponde ao tipo escolhido.");
      }

      resolvedAssignments.push({
        sessionTrack,
        pricingMode: "package",
        pricingPackageId: selectedPackage.id,
        hourlyRate: computePackageHourlyRate(
          Number(selectedPackage.package_price || 0),
          Number(selectedPackage.lesson_quantity || 0),
        ),
      });
      continue;
    }

    const { data: rateSetting, error: rateError } = await adminClient
      .from("commercial_rate_settings")
      .select("session_track, hourly_rate")
      .eq("session_track", sessionTrack)
      .maybeSingle();

    if (rateError) {
      throw new Error(rateError.message);
    }

    if (!rateSetting?.session_track) {
      throw new Error("O preco hora/aula selecionado nao foi encontrado.");
    }

    resolvedAssignments.push({
      sessionTrack,
      pricingMode: "rate",
      pricingPackageId: null,
      hourlyRate: parseHourlyRate(rateSetting.hourly_rate),
    });
  }

  const primaryTrack = getCommercialTracksFromScope(normalized.serviceScope)[0];
  const primaryAssignment =
    resolvedAssignments.find((item) => item.sessionTrack === primaryTrack) || resolvedAssignments[0];

  return {
    hourlyRate: primaryAssignment?.hourlyRate ?? hourlyRate,
    pricingMode: primaryAssignment?.pricingMode ?? null,
    pricingSessionTrack: primaryAssignment?.sessionTrack ?? null,
    pricingPackageId: primaryAssignment?.pricingPackageId ?? null,
    studentServiceScope: normalized.serviceScope,
    commercialAssignments: resolvedAssignments.map((assignment) => ({
      session_track: assignment.sessionTrack,
      pricing_mode: assignment.pricingMode,
      pricing_package_id: assignment.pricingPackageId,
      hourly_rate: assignment.hourlyRate,
    })),
  };
};

const findAuthUserById = async (adminClient: any, userId: string) => {
  const { data, error } = await adminClient.auth.admin.getUserById(userId);

  if (error) {
    throw new Error(error.message);
  }

  return data.user;
};

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
    const baseHourlyRate = role === "student" ? parseHourlyRate(payload.hourlyRate) : null;
    const requestedPricingMode =
      payload.pricingMode === "rate" || payload.pricingMode === "package"
        ? payload.pricingMode
        : payload.pricingMode === "legacy"
          ? "legacy"
          : null;
    const requestedPricingSessionTrack = payload.pricingSessionTrack?.trim() || null;
    const requestedPricingPackageId = payload.pricingPackageId?.trim() || null;
    const requestedStudentServiceScope = payload.studentServiceScope?.trim() || null;
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

    const studentPricing = await resolveStudentPricing({
      adminClient,
      role,
      hourlyRate: baseHourlyRate,
      pricingMode: requestedPricingMode,
      pricingSessionTrack: requestedPricingSessionTrack,
      pricingPackageId: requestedPricingPackageId,
      studentServiceScope: requestedStudentServiceScope,
      studentCommercialAssignments: payload.studentCommercialAssignments,
    });

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
      const authUser = await findAuthUserById(adminClient, userId);
      const currentEmail = normalizeEmail(String(authUser?.email || ""));
      const authUpdatePayload: Record<string, unknown> = {
        user_metadata: {
          full_name: fullName,
          role,
        },
      };

      if (email !== currentEmail) {
        authUpdatePayload.email = email;
      }

      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(
        userId,
        authUpdatePayload,
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
          hourly_rate: role === "student" ? studentPricing.hourlyRate : null,
          pricing_mode: role === "student" ? studentPricing.pricingMode : null,
          pricing_session_track:
            role === "student" ? studentPricing.pricingSessionTrack : null,
          pricing_package_id:
            role === "student" ? studentPricing.pricingPackageId : null,
          student_service_scope: role === "student" ? studentPricing.studentServiceScope : null,
          commercial_assignments:
            role === "student" ? studentPricing.commercialAssignments : [],
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
          hourly_rate: role === "student" ? studentPricing.hourlyRate : null,
          pricing_mode: role === "student" ? studentPricing.pricingMode : null,
          pricing_session_track:
            role === "student" ? studentPricing.pricingSessionTrack : null,
          pricing_package_id:
            role === "student" ? studentPricing.pricingPackageId : null,
          student_service_scope: role === "student" ? studentPricing.studentServiceScope : null,
          commercial_assignments:
            role === "student" ? studentPricing.commercialAssignments : [],
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
          hourly_rate: role === "student" ? studentPricing.hourlyRate : null,
          pricing_mode: role === "student" ? studentPricing.pricingMode : null,
          pricing_session_track:
            role === "student" ? studentPricing.pricingSessionTrack : null,
          pricing_package_id:
            role === "student" ? studentPricing.pricingPackageId : null,
          student_service_scope: role === "student" ? studentPricing.studentServiceScope : null,
          commercial_assignments:
            role === "student" ? studentPricing.commercialAssignments : [],
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
