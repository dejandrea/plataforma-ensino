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
  redirectTo?: string;
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
  hourlyRate,
  pricingMode,
  pricingSessionTrack,
  pricingPackageId,
  studentServiceScope,
  commercialAssignments,
}: {
  adminClient: any;
  userId: string;
  fullName: string;
  lastName: string | null;
  nickname: string | null;
  birthDate: string | null;
  role: string;
  hourlyRate: number | null;
  pricingMode: "rate" | "package" | null;
  pricingSessionTrack: string | null;
  pricingPackageId: string | null;
  studentServiceScope: string | null;
  commercialAssignments: Array<{
    session_track: "mentoring" | "course";
    pricing_mode: "rate" | "package";
    pricing_package_id: string | null;
    hourly_rate: number | null;
  }>;
}) => {
  const { error } = await adminClient.from("profiles").upsert({
    id: userId,
    full_name: fullName,
    last_name: lastName,
    nickname,
    birth_date: birthDate,
    role,
    hourly_rate: role === "student" ? hourlyRate : null,
    pricing_mode: role === "student" ? pricingMode : null,
    pricing_session_track: role === "student" ? pricingSessionTrack : null,
    pricing_package_id: role === "student" ? pricingPackageId : null,
    student_service_scope: role === "student" ? studentServiceScope : null,
    commercial_assignments: role === "student" ? commercialAssignments : [],
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
    const baseHourlyRate = role === "student" ? parseHourlyRate(payload.hourlyRate) : null;
    const requestedPricingMode =
      payload.pricingMode === "rate" || payload.pricingMode === "package"
        ? payload.pricingMode
        : null;
    const requestedPricingSessionTrack = payload.pricingSessionTrack?.trim() || null;
    const requestedPricingPackageId = payload.pricingPackageId?.trim() || null;
    const requestedStudentServiceScope = payload.studentServiceScope?.trim() || null;
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
          hourly_rate: role === "student" ? studentPricing.hourlyRate : null,
          pricing_mode: role === "student" ? studentPricing.pricingMode : null,
          pricing_session_track:
            role === "student" ? studentPricing.pricingSessionTrack : null,
          pricing_package_id:
            role === "student" ? studentPricing.pricingPackageId : null,
          student_service_scope: role === "student" ? studentPricing.studentServiceScope : null,
          commercial_assignments:
            role === "student" ? studentPricing.commercialAssignments : [],
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
          hourly_rate: role === "student" ? studentPricing.hourlyRate : null,
          pricing_mode: role === "student" ? studentPricing.pricingMode : null,
          pricing_session_track:
            role === "student" ? studentPricing.pricingSessionTrack : null,
          pricing_package_id:
            role === "student" ? studentPricing.pricingPackageId : null,
          student_service_scope: role === "student" ? studentPricing.studentServiceScope : null,
          commercial_assignments:
            role === "student" ? studentPricing.commercialAssignments : [],
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
          hourlyRate: studentPricing.hourlyRate,
          pricingMode: studentPricing.pricingMode,
          pricingSessionTrack: studentPricing.pricingSessionTrack,
          pricingPackageId: studentPricing.pricingPackageId,
          studentServiceScope: studentPricing.studentServiceScope,
          commercialAssignments: studentPricing.commercialAssignments,
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
      hourlyRate: studentPricing.hourlyRate,
      pricingMode: studentPricing.pricingMode,
      pricingSessionTrack: studentPricing.pricingSessionTrack,
      pricingPackageId: studentPricing.pricingPackageId,
      studentServiceScope: studentPricing.studentServiceScope,
      commercialAssignments: studentPricing.commercialAssignments,
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
