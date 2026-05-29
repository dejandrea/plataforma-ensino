import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  FunctionsHttpError,
  FunctionsRelayError,
  FunctionsFetchError,
} from "@supabase/supabase-js";

type AccessInvite = {
  invite_id: string | null;
  user_id: string | null;
  email: string | null;
  full_name: string | null;
  last_name: string | null;
  nickname: string | null;
  birth_date: string | null;
  role: string | null;
  invited_at: string | null;
  claimed_at: string | null;
  claimed_user_id: string | null;
  is_active: boolean | null;
  source: "invite_only" | "claimed_invite" | "legacy_profile";
  can_delete_invite: boolean;
};

const initialUserForm = {
  name: "",
  lastName: "",
  nickname: "",
  email: "",
  birthDate: "",
  role: "student",
};

export const TabUsers = () => {
  const [users, setUsers] = useState<AccessInvite[]>([]);
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
  }, []);

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
      setUsers((data || []) as AccessInvite[]);
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
        .select("id, full_name, last_name, nickname, birth_date, role, invited_at, is_active"),
    ]);

    if (inviteError || profileError) {
      console.error("Erro ao buscar usuarios da gestao:", {
        inviteError,
        profileError,
      });
      setUsers([]);
      return;
    }

    setUsers(
      normalizeFallbackUsers(inviteData || [], profileData || []),
    );
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

    const { data, error } = await supabase.functions.invoke("create-platform-user", {
      body: {
        email: newUser.email,
        fullName: `${newUser.name} ${newUser.lastName}`.trim(),
        lastName: newUser.lastName,
        nickname: newUser.nickname || null,
        birthDate: newUser.birthDate || null,
        role: newUser.role,
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

  const openEditModal = (user: AccessInvite) => {
    const fullName = user.full_name || "";
    const lastName = user.last_name || "";
    const inferredName = lastName && fullName.endsWith(lastName)
      ? fullName.slice(0, fullName.length - lastName.length).trim()
      : fullName;

    setEditingUser(user);
    setEditForm({
      name: inferredName,
      lastName,
      nickname: user.nickname || "",
      email: user.email || "",
      birthDate: user.birth_date ? String(user.birth_date).slice(0, 10) : "",
      role: user.role || "student",
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
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            >
              <option value="student" className="bg-gray-900">
                Aluno
              </option>
              <option value="professor" className="bg-gray-900">
                Professor(a)
              </option>
              <option value="admin" className="bg-gray-900">
                Administrador
              </option>
            </select>
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
            className="w-full max-w-2xl rounded-[2rem] bg-[#140f25] p-6 shadow-soft ring-1 ring-white/10 md:p-8"
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

            <form onSubmit={handleSaveUser} className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                >
                  <option value="student" className="bg-gray-900">
                    Aluno
                  </option>
                  <option value="professor" className="bg-gray-900">
                    Professor(a)
                  </option>
                  <option value="admin" className="bg-gray-900">
                    Administrador
                  </option>
                </select>
              </div>

              <div className="md:col-span-2 flex gap-3 pt-2">
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
