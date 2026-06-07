import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  FunctionsHttpError,
  FunctionsRelayError,
  FunctionsFetchError,
} from "@supabase/supabase-js";

type SessionTrack = "mentoring" | "course";
type StudentPricingMode = "rate" | "package" | "legacy";
type StudentServiceScope = "mentoring" | "course" | "both";

type StudentCommercialAssignment = {
  session_track: SessionTrack;
  pricing_mode: "rate" | "package";
  pricing_package_id: string | null;
  hourly_rate: number | null;
};

type AccessInvite = {
  invite_id: string | null;
  user_id: string | null;
  email: string | null;
  full_name: string | null;
  last_name: string | null;
  nickname: string | null;
  birth_date: string | null;
  role: string | null;
  hourly_rate: number | null;
  pricing_mode: "rate" | "package" | null;
  pricing_session_track: SessionTrack | null;
  pricing_package_id: string | null;
  student_service_scope?: StudentServiceScope | null;
  commercial_assignments?: StudentCommercialAssignment[] | null;
  invited_at: string | null;
  claimed_at: string | null;
  claimed_user_id: string | null;
  is_active: boolean | null;
  source: "invite_only" | "claimed_invite" | "legacy_profile";
  can_delete_invite: boolean;
};

type CommercialRateOption = {
  id: string;
  session_track: SessionTrack;
  hourly_rate: number | null;
  notes?: string | null;
};

type CommercialPackageOption = {
  id: string;
  name: string;
  session_track: SessionTrack;
  lesson_quantity: number;
  package_price: number;
  validity_days: number | null;
  is_active: boolean;
};

const initialUserForm = {
  name: "",
  lastName: "",
  nickname: "",
  email: "",
  birthDate: "",
  role: "student",
  hourlyRate: "",
  pricingMode: "rate" as StudentPricingMode,
  pricingSessionTrack: "mentoring" as SessionTrack,
  pricingPackageId: "",
  studentServiceScope: "mentoring" as StudentServiceScope,
  mentoringPricingMode: "rate" as StudentPricingMode,
  mentoringPricingPackageId: "",
  coursePricingMode: "rate" as StudentPricingMode,
  coursePricingPackageId: "",
};

type UserFormState = typeof initialUserForm;

const selectStyle = {
  backgroundColor: "#241d33",
  color: "#ffffff",
};

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const getTrackLabel = (track: SessionTrack) =>
  track === "course" ? "Curso" : "Mentoria";

const getPackageEffectiveHourlyRate = (item: CommercialPackageOption) => {
  if (!item.lesson_quantity) {
    return null;
  }

  return Number((Number(item.package_price || 0) / Number(item.lesson_quantity)).toFixed(2));
};

const getCommercialTracksFromScope = (scope: StudentServiceScope) => {
  if (scope === "course") {
    return ["course"] as const;
  }

  return ["mentoring"] as const;
};

const getScopeFromTrackSelection = (selection: {
  mentoring: boolean;
  course: boolean;
}): StudentServiceScope | null => {
  if (selection.mentoring && selection.course) {
    return "both";
  }

  if (selection.course) {
    return "course";
  }

  if (selection.mentoring) {
    return "mentoring";
  }

  return null;
};

const inferStudentServiceScope = (user: AccessInvite): StudentServiceScope => {
  if (user.student_service_scope === "mentoring" || user.student_service_scope === "course") {
    return user.student_service_scope;
  }

  if (user.student_service_scope === "both") {
    return "both";
  }

  const assignmentTracks = (user.commercial_assignments || [])
    .map((item) => item.session_track)
    .filter((track): track is SessionTrack => track === "mentoring" || track === "course");

  if (assignmentTracks.includes("mentoring") && assignmentTracks.includes("course")) {
    return "both";
  }

  if (assignmentTracks.includes("course")) {
    return "course";
  }

  if (user.pricing_session_track === "course") {
    return "course";
  }

  return "mentoring";
};

const getStoredAssignments = (user: AccessInvite): StudentCommercialAssignment[] => {
  if (Array.isArray(user.commercial_assignments) && user.commercial_assignments.length > 0) {
    return user.commercial_assignments.filter(
      (item): item is StudentCommercialAssignment =>
        Boolean(
          item &&
            (item.session_track === "mentoring" || item.session_track === "course") &&
            (item.pricing_mode === "rate" || item.pricing_mode === "package"),
        ),
    );
  }

  if (
    (user.pricing_mode === "rate" || user.pricing_mode === "package") &&
    (user.pricing_session_track === "mentoring" || user.pricing_session_track === "course")
  ) {
    return [
      {
        session_track: user.pricing_session_track,
        pricing_mode: user.pricing_mode,
        pricing_package_id: user.pricing_package_id,
        hourly_rate: user.hourly_rate,
      },
    ];
  }

  return [];
};

const buildStudentPricingPayload = (form: UserFormState) => {
  const tracks = getCommercialTracksFromScope(form.studentServiceScope);
  const assignments = tracks.map((track) => {
    const pricingMode =
      track === "course" ? form.coursePricingMode : form.mentoringPricingMode;
    const pricingPackageId =
      track === "course"
        ? form.coursePricingPackageId || null
        : form.mentoringPricingPackageId || null;

    return {
      sessionTrack: track,
      pricingMode: pricingMode === "package" ? "package" : "rate",
      pricingPackageId: pricingMode === "package" ? pricingPackageId : null,
    };
  });

  const primaryAssignment = assignments[0];

  return {
    hourlyRate: null,
    pricingMode: primaryAssignment.pricingMode,
    pricingSessionTrack: primaryAssignment.sessionTrack,
    pricingPackageId: primaryAssignment.pricingPackageId,
    studentServiceScope: form.studentServiceScope,
    studentCommercialAssignments: assignments,
  };
};

export const TabUsers = () => {
  const [users, setUsers] = useState<AccessInvite[]>([]);
  const [commercialRates, setCommercialRates] = useState<CommercialRateOption[]>([]);
  const [commercialPackages, setCommercialPackages] = useState<CommercialPackageOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<AccessInvite | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [newUser, setNewUser] = useState(initialUserForm);
  const [editForm, setEditForm] = useState(initialUserForm);

  const getFunctionErrorMessage = async (error: unknown) => {
    if (error instanceof FunctionsHttpError) {
      try {
        const errorBody = await error.context.json();
        if (typeof errorBody?.error === "string") {
          return errorBody.error;
        }
      } catch {
        return "A Edge Function retornou um erro inesperado.";
      }

      return "A Edge Function retornou um erro inesperado.";
    }

    if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return "Erro desconhecido ao chamar a Edge Function.";
  };

  useEffect(() => {
    void fetchUsers();
    void fetchCommercialOptions();
  }, []);

  const fetchCommercialOptions = async () => {
    const [{ data: rateRows, error: ratesError }, { data: packageRows, error: packagesError }] =
      await Promise.all([
        supabase
          .from("commercial_rate_settings")
          .select("id, session_track, hourly_rate, notes")
          .order("session_track"),
        supabase
          .from("commercial_packages")
          .select("id, name, session_track, lesson_quantity, package_price, validity_days, is_active")
          .order("created_at", { ascending: false }),
      ]);

    if (ratesError) {
      console.error("Erro ao buscar precos comerciais:", ratesError.message);
      setCommercialRates([]);
    } else {
      setCommercialRates((rateRows || []) as CommercialRateOption[]);
    }

    if (packagesError) {
      console.error("Erro ao buscar pacotes comerciais:", packagesError.message);
      setCommercialPackages([]);
    } else {
      setCommercialPackages((packageRows || []) as CommercialPackageOption[]);
    }
  };

  const mergeCommercialSettings = async (baseUsers: AccessInvite[]) => {
    const { data, error } = await supabase.rpc("list_user_commercial_settings");

    if (error) {
      console.warn(
        "RPC list_user_commercial_settings indisponivel, seguindo com campos comerciais legados:",
        error.message,
      );
      return baseUsers;
    }

    const byInviteId = new Map<
      string,
      {
        student_service_scope: StudentServiceScope | null;
        commercial_assignments: StudentCommercialAssignment[] | null;
      }
    >();
    const byUserId = new Map<
      string,
      {
        student_service_scope: StudentServiceScope | null;
        commercial_assignments: StudentCommercialAssignment[] | null;
      }
    >();

    ((data || []) as Array<{
      invite_id: string | null;
      user_id: string | null;
      student_service_scope: StudentServiceScope | null;
      commercial_assignments: StudentCommercialAssignment[] | null;
    }>).forEach((item) => {
      const payload = {
        student_service_scope: item.student_service_scope,
        commercial_assignments: item.commercial_assignments,
      };

      if (item.invite_id) {
        byInviteId.set(item.invite_id, payload);
      }

      if (item.user_id) {
        byUserId.set(item.user_id, payload);
      }
    });

    return baseUsers.map((user) => {
      const extra =
        (user.invite_id ? byInviteId.get(user.invite_id) : undefined) ||
        (user.user_id ? byUserId.get(user.user_id) : undefined);

      if (!extra) {
        return user;
      }

      return {
        ...user,
        student_service_scope: extra.student_service_scope,
        commercial_assignments: extra.commercial_assignments,
      };
    });
  };

  const normalizeFallbackUsers = (
    inviteRows: any[],
    profileRows: any[],
  ): AccessInvite[] => {
    const profileMap = new Map(profileRows.map((profile) => [profile.id, profile]));
    const claimedProfileIds = new Set(
      inviteRows
        .map((invite) => invite.claimed_user_id)
        .filter((claimedUserId) => Boolean(claimedUserId)),
    );

    const inviteUsers: AccessInvite[] = inviteRows.map((invite) => ({
      invite_id: invite.id,
      user_id: invite.claimed_user_id,
      email: invite.email,
      full_name: invite.full_name,
      last_name: invite.last_name,
      nickname: invite.nickname,
      birth_date: invite.birth_date,
      role: invite.role,
      hourly_rate: invite.hourly_rate ?? profileMap.get(invite.claimed_user_id)?.hourly_rate ?? null,
      pricing_mode:
        invite.pricing_mode ?? profileMap.get(invite.claimed_user_id)?.pricing_mode ?? null,
      pricing_session_track:
        invite.pricing_session_track ??
        profileMap.get(invite.claimed_user_id)?.pricing_session_track ??
        null,
      pricing_package_id:
        invite.pricing_package_id ??
        profileMap.get(invite.claimed_user_id)?.pricing_package_id ??
        null,
      student_service_scope:
        invite.student_service_scope ??
        profileMap.get(invite.claimed_user_id)?.student_service_scope ??
        null,
      commercial_assignments:
        invite.commercial_assignments ??
        profileMap.get(invite.claimed_user_id)?.commercial_assignments ??
        [],
      invited_at: invite.invited_at,
      claimed_at: invite.claimed_at,
      claimed_user_id: invite.claimed_user_id,
      is_active: invite.claimed_user_id
        ? profileMap.get(invite.claimed_user_id)?.is_active ?? true
        : true,
      source: invite.claimed_at ? "claimed_invite" : "invite_only",
      can_delete_invite: true,
    }));

    const legacyUsers: AccessInvite[] = profileRows
      .filter((profile) => !claimedProfileIds.has(profile.id))
      .map((profile) => ({
        invite_id: null,
        user_id: profile.id,
        email: null,
        full_name: profile.full_name,
        last_name: profile.last_name,
        nickname: profile.nickname,
        birth_date: profile.birth_date,
        role: profile.role,
        hourly_rate: profile.hourly_rate ?? null,
        pricing_mode: profile.pricing_mode ?? null,
        pricing_session_track: profile.pricing_session_track ?? null,
        pricing_package_id: profile.pricing_package_id ?? null,
        student_service_scope: profile.student_service_scope ?? null,
        commercial_assignments: profile.commercial_assignments ?? [],
        invited_at: profile.invited_at,
        claimed_at: profile.invited_at,
        claimed_user_id: profile.id,
        is_active: profile.is_active,
        source: "legacy_profile",
        can_delete_invite: false,
      }));

    return [...inviteUsers, ...legacyUsers].sort((left, right) => {
      const leftTime = left.invited_at ? new Date(left.invited_at).getTime() : 0;
      const rightTime = right.invited_at ? new Date(right.invited_at).getTime() : 0;
      return rightTime - leftTime;
    });
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase.rpc("list_system_users");

    if (!error) {
      const mergedUsers = await mergeCommercialSettings((data || []) as AccessInvite[]);
      setUsers(mergedUsers);
      return;
    }

    console.warn(
      "RPC list_system_users indisponivel, usando fallback local:",
      error.message,
    );

    const [
      { data: inviteData, error: inviteError },
      { data: profileData, error: profileError },
    ] = await Promise.all([
      supabase.rpc("list_access_invites"),
      supabase
        .from("profiles")
        .select(
          "id, full_name, last_name, nickname, birth_date, role, hourly_rate, pricing_mode, pricing_session_track, pricing_package_id, student_service_scope, commercial_assignments, invited_at, is_active",
        ),
    ]);

    if (inviteError || profileError) {
      console.error("Erro ao buscar usuarios da gestao:", {
        inviteError,
        profileError,
      });
      setUsers([]);
      return;
    }

    const normalizedUsers = normalizeFallbackUsers(inviteData || [], profileData || []);
    const mergedUsers = await mergeCommercialSettings(normalizedUsers);
    setUsers(mergedUsers);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const emailExists = users.some(
      (user) => user.email?.toLowerCase() === newUser.email.toLowerCase(),
    );

    if (emailExists) {
      alert("Este e-mail ja esta autorizado no sistema.");
      setLoading(false);
      return;
    }

    const studentPricing =
      newUser.role === "student" ? buildStudentPricingPayload(newUser) : null;

    const { data, error } = await supabase.functions.invoke("create-platform-user", {
      body: {
        email: newUser.email,
        fullName: `${newUser.name} ${newUser.lastName}`.trim(),
        lastName: newUser.lastName,
        nickname: newUser.nickname || null,
        birthDate: newUser.birthDate || null,
        role: newUser.role,
        hourlyRate: studentPricing?.hourlyRate || null,
        pricingMode: studentPricing?.pricingMode || null,
        pricingSessionTrack: studentPricing?.pricingSessionTrack || null,
        pricingPackageId: studentPricing?.pricingPackageId || null,
        studentServiceScope: studentPricing?.studentServiceScope || null,
        studentCommercialAssignments: studentPricing?.studentCommercialAssignments || [],
        redirectTo: `${window.location.origin}/redefinir-senha`,
      },
    });

    if (error) {
      alert("Erro ao cadastrar usuario: " + error.message);
    } else {
      alert(
        data?.message ||
          "Usuario cadastrado com sucesso. O link para definir a senha foi enviado por e-mail.",
      );
      setNewUser(initialUserForm);
      void fetchUsers();
    }

    setLoading(false);
  };

  const getInitialPricingMode = (user: AccessInvite): StudentPricingMode => {
    if (user.pricing_mode === "package" && user.pricing_package_id) {
      return "package";
    }

    if (user.pricing_mode === "rate" && user.pricing_session_track) {
      return "rate";
    }

    if (user.hourly_rate != null) {
      return "legacy";
    }

    return "rate";
  };

  const openEditModal = (user: AccessInvite) => {
    const fullName = user.full_name || "";
    const lastName = user.last_name || "";
    const inferredName = lastName && fullName.endsWith(lastName)
      ? fullName.slice(0, fullName.length - lastName.length).trim()
      : fullName;
    const initialPricingMode = getInitialPricingMode(user);
    const normalizedInitialPricingMode =
      initialPricingMode === "legacy" ? "rate" : initialPricingMode;
    const serviceScope = inferStudentServiceScope(user);
    const assignments = getStoredAssignments(user);
    const mentoringAssignment = assignments.find((item) => item.session_track === "mentoring");
    const courseAssignment = assignments.find((item) => item.session_track === "course");

    setEditingUser(user);
    setEditForm({
      name: inferredName,
      lastName,
      nickname: user.nickname || "",
      email: user.email || "",
      birthDate: user.birth_date ? String(user.birth_date).slice(0, 10) : "",
      role: user.role || "student",
      hourlyRate: user.hourly_rate != null ? String(user.hourly_rate) : "",
      pricingMode: normalizedInitialPricingMode,
      pricingSessionTrack: user.pricing_session_track || "mentoring",
      pricingPackageId: user.pricing_package_id || "",
      studentServiceScope: serviceScope,
      mentoringPricingMode: mentoringAssignment?.pricing_mode || normalizedInitialPricingMode,
      mentoringPricingPackageId: mentoringAssignment?.pricing_package_id || "",
      coursePricingMode: courseAssignment?.pricing_mode || "rate",
      coursePricingPackageId: courseAssignment?.pricing_package_id || "",
    });
  };

  const closeEditModal = () => {
    if (editLoading) return;
    setEditingUser(null);
    setEditForm(initialUserForm);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingUser) return;

    setEditLoading(true);

    const fullName = `${editForm.name} ${editForm.lastName}`.trim();
    const studentPricing =
      editForm.role === "student" ? buildStudentPricingPayload(editForm) : null;
    try {
      const { data, error } = await supabase.functions.invoke("update-platform-user", {
        body: {
          inviteId: editingUser.invite_id,
          userId: editingUser.user_id,
          email: editForm.email,
          fullName,
          lastName: editForm.lastName,
          nickname: editForm.nickname || null,
          birthDate: editForm.birthDate || null,
          role: editForm.role,
          hourlyRate: studentPricing?.hourlyRate || null,
          pricingMode: studentPricing?.pricingMode || null,
          pricingSessionTrack: studentPricing?.pricingSessionTrack || null,
          pricingPackageId: studentPricing?.pricingPackageId || null,
          studentServiceScope: studentPricing?.studentServiceScope || null,
          studentCommercialAssignments: studentPricing?.studentCommercialAssignments || [],
          isActive: editingUser.is_active ?? true,
        },
      });

      if (error) {
        throw error;
      }

      alert(data?.message || "Usuario atualizado com sucesso.");
      setEditingUser(null);
      setEditForm(initialUserForm);
      await fetchUsers();
    } catch (error) {
      const message = await getFunctionErrorMessage(error);
      alert("Erro ao salvar usuario: " + message);
    }

    setEditLoading(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <section className="rounded-3xl bg-white/5 p-6 shadow-soft ring-1 ring-white/10 backdrop-blur">
        <h2 className="text-xl font-bold text-white italic">
          Cadastrar novo usuario
        </h2>
        <p className="mt-1 text-sm text-white/50">
          A administracao cria o acesso por aqui e o usuario recebe um link para definir a senha no primeiro acesso.
        </p>

        <form
          onSubmit={handleCreateUser}
          className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4 items-end"
        >
          <div className="space-y-1">
            <label className="ml-1 text-[10px] font-black uppercase text-white/30">
              Nome
            </label>
            <input
              required
              placeholder="Ex: Ana"
              className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 outline-none transition focus:ring-2 focus:ring-brand-lavender"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            />

            <label className="ml-1 text-[10px] font-black uppercase text-white/30">
              Sobrenome
            </label>
            <input
              required
              placeholder="Ex: Silva"
              className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 outline-none transition focus:ring-2 focus:ring-brand-lavender"
              value={newUser.lastName}
              onChange={(e) =>
                setNewUser({ ...newUser, lastName: e.target.value })
              }
            />

            <label className="ml-1 text-[10px] font-black uppercase text-white/30">
              Apelido
            </label>
            <input
              placeholder="Aninha"
              className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 outline-none transition focus:ring-2 focus:ring-brand-lavender"
              value={newUser.nickname}
              onChange={(e) =>
                setNewUser({ ...newUser, nickname: e.target.value })
              }
            />
          </div>

          <div className="space-y-1">
            <label className="ml-1 text-[10px] font-black uppercase text-white/30">
              E-mail de acesso
            </label>
            <input
              required
              type="email"
              placeholder="ana@email.com"
              className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 outline-none transition focus:ring-2 focus:ring-brand-lavender"
              value={newUser.email}
              onChange={(e) =>
                setNewUser({ ...newUser, email: e.target.value })
              }
            />

            <label className="ml-1 text-[10px] font-black uppercase text-white/30">
              Data de nascimento
            </label>
            <input
              required
              type="date"
              className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 outline-none transition focus:ring-2 focus:ring-brand-lavender"
              value={newUser.birthDate}
              onChange={(e) =>
                setNewUser({ ...newUser, birthDate: e.target.value })
              }
            />

            <label className="ml-1 text-[10px] font-black uppercase text-white/30">
              Nivel de acesso
            </label>
            <select
              className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 outline-none transition focus:ring-2 focus:ring-brand-lavender"
              style={selectStyle}
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            >
              <option value="student" style={selectStyle}>
                Aluno
              </option>
              <option value="professor" style={selectStyle}>
                Professor(a)
              </option>
              <option value="admin" style={selectStyle}>
                Administrador
              </option>
            </select>

            {newUser.role === "student" && (
              <StudentCommercialFields
                form={newUser}
                onChange={(patch) => setNewUser({ ...newUser, ...patch })}
                rateOptions={commercialRates}
                packageOptions={commercialPackages}
              />
            )}
          </div>

          <button
            disabled={loading}
            className="mt-5 flex h-[46px] items-center justify-center rounded-2xl bg-gradient-to-r from-brand-magenta to-brand-pink text-sm font-black uppercase tracking-widest text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "Processando..." : "Autorizar"}
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h3 className="ml-1 text-xs font-semibold uppercase tracking-widest text-white/40">
          Usuarios com acesso ({users.length})
        </h3>

        <div className="overflow-hidden rounded-3xl bg-white/5 ring-1 ring-white/10 backdrop-blur">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-[11px] uppercase text-white/40">
              <tr>
                <th className="px-6 py-4">Nome</th>
                <th className="px-6 py-4">E-mail</th>
                <th className="px-6 py-4">Cargo</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Acao</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((user, index) => (
                <tr
                  key={user.invite_id || user.user_id || user.email || `user-row-${index}`}
                  className="group transition hover:bg-white/5"
                >
                  <td className="px-6 py-4 font-bold text-white">
                    {user.full_name || "Sem nome"}
                  </td>
                  <td className="px-6 py-4 text-white/60">
                    {user.email || "Sem e-mail"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase ring-1 ${
                        user.role === "admin"
                          ? "bg-purple-500/10 text-purple-400 ring-purple-400/30"
                          : user.role === "professor"
                            ? "bg-blue-500/10 text-blue-400 ring-blue-400/30"
                            : "bg-gray-500/10 text-gray-400 ring-white/20"
                      }`}
                    >
                      {user.role || "sem cargo"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-1.5 w-1.5 rounded-full ${
                          user.source === "invite_only"
                            ? "bg-amber-400"
                            : user.is_active === false
                              ? "bg-rose-400"
                              : user.claimed_at || user.source === "legacy_profile"
                                ? "bg-emerald-400"
                            : "bg-amber-400"
                        }`}
                      />
                      <span className="text-[10px] font-medium text-white/50">
                        {user.source === "invite_only"
                          ? "Pendente"
                          : user.is_active === false
                            ? "Inativo"
                            : user.source === "legacy_profile"
                              ? "Legado"
                          : user.claimed_at
                            ? "Ativado"
                            : "Pendente"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => openEditModal(user)}
                        className="text-white/50 transition-colors hover:text-brand-lavender"
                      >
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="py-12 text-center text-white/30 italic">
              Nenhum usuario cadastrado.
            </div>
          )}
        </div>
      </section>

      {editingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm"
          onClick={closeEditModal}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] bg-[#140f25] p-6 shadow-soft ring-1 ring-white/10 md:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
                  Editar usuario
                </p>
                <h2 className="mt-2 text-2xl font-bold text-white">
                  Atualizar acesso e perfil
                </h2>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
              >
                Fechar
              </button>
            </div>

            <form
              onSubmit={handleSaveUser}
              className="mt-6 flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto pr-1 md:grid-cols-2">
              <div className="space-y-1">
                <label className="ml-1 text-[10px] font-black uppercase text-white/30">
                  Nome
                </label>
                <input
                  required
                  className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 outline-none transition focus:ring-2 focus:ring-brand-lavender"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="ml-1 text-[10px] font-black uppercase text-white/30">
                  Sobrenome
                </label>
                <input
                  required
                  className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 outline-none transition focus:ring-2 focus:ring-brand-lavender"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="ml-1 text-[10px] font-black uppercase text-white/30">
                  Apelido
                </label>
                <input
                  className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 outline-none transition focus:ring-2 focus:ring-brand-lavender"
                  value={editForm.nickname}
                  onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="ml-1 text-[10px] font-black uppercase text-white/30">
                  E-mail
                </label>
                <input
                  required
                  type="email"
                  className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 outline-none transition focus:ring-2 focus:ring-brand-lavender"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="ml-1 text-[10px] font-black uppercase text-white/30">
                  Data de nascimento
                </label>
                <input
                  required
                  type="date"
                  className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 outline-none transition focus:ring-2 focus:ring-brand-lavender"
                  value={editForm.birthDate}
                  onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="ml-1 text-[10px] font-black uppercase text-white/30">
                  Nivel de acesso
                </label>
                <select
                  className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 outline-none transition focus:ring-2 focus:ring-brand-lavender"
                  style={selectStyle}
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                >
                  <option value="student" style={selectStyle}>
                    Aluno
                  </option>
                  <option value="professor" style={selectStyle}>
                    Professor(a)
                  </option>
                  <option value="admin" style={selectStyle}>
                    Administrador
                  </option>
                </select>
              </div>

              {editForm.role === "student" && (
                <StudentCommercialFields
                  form={editForm}
                  onChange={(patch) => setEditForm({ ...editForm, ...patch })}
                  rateOptions={commercialRates}
                  packageOptions={commercialPackages}
                  allowLegacy
                />
              )}
              </div>

              <div className="mt-4 flex shrink-0 gap-3 border-t border-white/10 pt-4 md:col-span-2">
                {editingUser.user_id && (
                  <button
                    type="button"
                    onClick={() =>
                      setEditingUser({
                        ...editingUser,
                        is_active: !(editingUser.is_active ?? true),
                      })
                    }
                    className="rounded-2xl bg-white/5 px-4 py-4 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
                  >
                    {editingUser.is_active === false ? "Deixar ativo" : "Deixar inativo"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-2xl bg-white/5 px-4 py-4 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-brand-magenta to-brand-pink px-4 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-soft transition hover:brightness-110 disabled:opacity-50"
                  >
                    {editLoading ? "Salvando..." : "Salvar usuario"}
                  </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

type StudentCommercialFieldsProps = {
  form: UserFormState;
  onChange: (patch: Partial<UserFormState>) => void;
  rateOptions: CommercialRateOption[];
  packageOptions: CommercialPackageOption[];
  allowLegacy?: boolean;
};

const StudentCommercialFields = ({
  form,
  onChange,
  rateOptions,
  packageOptions,
}: StudentCommercialFieldsProps) => {
  const activeTracks = getCommercialTracksFromScope(form.studentServiceScope);
  const selectedTracks = {
    mentoring:
      form.studentServiceScope === "mentoring" || form.studentServiceScope === "both",
    course:
      form.studentServiceScope === "course" || form.studentServiceScope === "both",
  };

  const handleTrackToggle =
    (track: SessionTrack) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextSelection = {
        mentoring: track === "mentoring" ? event.target.checked : selectedTracks.mentoring,
        course: track === "course" ? event.target.checked : selectedTracks.course,
      };
      const nextScope = getScopeFromTrackSelection(nextSelection);

      if (!nextScope) {
        return;
      }

      onChange({ studentServiceScope: nextScope });
    };

  return (
    <div className="space-y-3 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10 md:col-span-2">
      <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)] md:items-end">
        <div className="space-y-1">
          <label className="ml-1 text-[10px] font-black uppercase text-white/30">
            Tipo de atendimento
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="inline-flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-white/20 bg-transparent accent-brand-magenta"
              checked={selectedTracks.mentoring}
              onChange={handleTrackToggle("mentoring")}
            />
            <span>Mentoria</span>
          </label>
          <label className="inline-flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-white/20 bg-transparent accent-brand-magenta"
              checked={selectedTracks.course}
              onChange={handleTrackToggle("course")}
            />
            <span>Curso</span>
          </label>
        </div>
      </div>

      <div className="space-y-2">
        {activeTracks.map((track) => {
          const trackPackages = packageOptions.filter(
            (item) => item.is_active && item.session_track === track,
          );
          const selectedPricingMode =
            track === "course" ? form.coursePricingMode : form.mentoringPricingMode;
          const selectedPackageId =
            track === "course"
              ? form.coursePricingPackageId
              : form.mentoringPricingPackageId;
          const selectedRate = rateOptions.find((item) => item.session_track === track);

          return (
            <div
              key={track}
              className="grid gap-3 rounded-2xl bg-black/15 p-3 ring-1 ring-white/10 md:grid-cols-[140px_180px_minmax(0,1fr)] md:items-end"
            >
              <div className="space-y-1">
                <div>
                  <p className="text-sm font-bold text-white">{getTrackLabel(track)}</p>
                </div>
                <span className="inline-flex rounded-full bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/40 ring-1 ring-white/10">
                  {track === "course" ? "Curso" : "Mentoria"}
                </span>
              </div>

              <div className="space-y-1">
                  <label className="ml-1 text-[10px] font-black uppercase text-white/30">
                    Plano
                  </label>
                  <select
                    className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 outline-none transition focus:ring-2 focus:ring-brand-lavender"
                    style={selectStyle}
                    value={selectedPricingMode}
                    onChange={(event) =>
                      onChange(
                        track === "course"
                          ? {
                              coursePricingMode: event.target.value as StudentPricingMode,
                              pricingMode: event.target.value as StudentPricingMode,
                              pricingSessionTrack: "course",
                            }
                          : {
                              mentoringPricingMode: event.target.value as StudentPricingMode,
                              pricingMode: event.target.value as StudentPricingMode,
                              pricingSessionTrack: "mentoring",
                            },
                      )
                    }
                  >
                    <option value="rate" style={selectStyle}>
                      Preco hora/aula
                    </option>
                    <option value="package" style={selectStyle}>
                      Pacote
                    </option>
                  </select>
                </div>

                {selectedPricingMode === "package" ? (
                  <div className="space-y-1">
                    <label className="ml-1 text-[10px] font-black uppercase text-white/30">
                      Pacote
                    </label>
                    <select
                      className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 outline-none transition focus:ring-2 focus:ring-brand-lavender"
                      style={selectStyle}
                      value={selectedPackageId}
                      onChange={(event) =>
                        onChange(
                          track === "course"
                            ? {
                                coursePricingPackageId: event.target.value,
                                pricingPackageId: event.target.value,
                              }
                            : {
                                mentoringPricingPackageId: event.target.value,
                                pricingPackageId: event.target.value,
                              },
                        )
                      }
                    >
                      <option value="" style={selectStyle}>
                        Selecione um pacote
                      </option>
                      {trackPackages.map((item) => {
                        const effectiveHourlyRate = getPackageEffectiveHourlyRate(item);
                        return (
                          <option key={item.id} value={item.id} style={selectStyle}>
                            {item.name} • {item.lesson_quantity} aula(s) • {formatCurrency(Number(item.package_price || 0))}
                            {effectiveHourlyRate != null
                              ? ` • ${formatCurrency(effectiveHourlyRate)}/aula`
                              : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="ml-1 text-[10px] font-black uppercase text-white/30">
                      Preco hora/aula
                    </label>
                    <select
                      disabled
                      className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/80 ring-1 ring-white/15 outline-none transition disabled:cursor-not-allowed disabled:opacity-80"
                      style={selectStyle}
                      value={selectedRate?.session_track || track}
                    >
                      <option value={track} style={selectStyle}>
                        {selectedRate
                          ? `${getTrackLabel(track)} • ${formatCurrency(Number(selectedRate.hourly_rate || 0))}/hora`
                          : `${getTrackLabel(track)} • sem preco cadastrado`}
                      </option>
                    </select>
                  </div>
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
