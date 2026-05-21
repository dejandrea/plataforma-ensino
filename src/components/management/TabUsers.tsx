import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

type AccessInvite = {
  id: string;
  email: string;
  full_name: string | null;
  last_name: string | null;
  nickname: string | null;
  birth_date: string | null;
  role: string;
  invited_at: string;
  claimed_at: string | null;
  claimed_user_id: string | null;
};

export const TabUsers = () => {
  const [users, setUsers] = useState<AccessInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    lastName: "",
    nickname: "",
    email: "",
    birthDate: "",
    role: "student",
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data, error } = await supabase.rpc("list_access_invites");

    if (error) {
      console.error("Erro ao buscar usuarios autorizados:", error);
    } else {
      setUsers((data || []) as AccessInvite[]);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const emailExists = users.some(
      (user) => user.email.toLowerCase() === newUser.email.toLowerCase(),
    );

    if (emailExists) {
      alert("Este e-mail ja esta autorizado no sistema.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.rpc("create_access_invite", {
      p_email: newUser.email,
      p_full_name: `${newUser.name} ${newUser.lastName}`.trim(),
      p_last_name: newUser.lastName,
      p_nickname: newUser.nickname || null,
      p_birth_date: newUser.birthDate || null,
      p_role: newUser.role,
    });

    if (error) {
      alert("Erro ao autorizar: " + error.message);
    } else {
      alert("Acesso autorizado com sucesso.");
      setNewUser({
        name: "",
        lastName: "",
        nickname: "",
        email: "",
        birthDate: "",
        role: "student",
      });
      fetchUsers();
    }

    setLoading(false);
  };

  const deleteUser = async (id: string) => {
    if (
      !window.confirm(
        "Tem certeza que deseja remover esta autorizacao? O usuario perdera o acesso de cadastro.",
      )
    ) {
      return;
    }

    const { error } = await supabase.rpc("delete_access_invite", {
      p_invite_id: id,
    });

    if (error) {
      alert("Erro ao remover: " + error.message);
    } else {
      fetchUsers();
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <section className="rounded-3xl bg-white/5 p-6 shadow-soft ring-1 ring-white/10 backdrop-blur">
        <h2 className="text-xl font-bold text-white italic">
          Autorizar novo acesso
        </h2>
        <p className="mt-1 text-sm text-white/50">
          O e-mail cadastrado aqui sera o unico permitido para criar conta.
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
              {users.map((user) => (
                <tr key={user.id} className="group transition hover:bg-white/5">
                  <td className="px-6 py-4 font-bold text-white">
                    {user.full_name}
                  </td>
                  <td className="px-6 py-4 text-white/60">{user.email}</td>
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
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-1.5 w-1.5 rounded-full ${
                          user.claimed_at ? "bg-emerald-400" : "bg-amber-400"
                        }`}
                      />
                      <span className="text-[10px] font-medium text-white/50">
                        {user.claimed_at ? "Ativado" : "Pendente"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => deleteUser(user.id)}
                      className="text-white/20 hover:text-rose-500 transition-colors"
                    >
                      Remover
                    </button>
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
    </div>
  );
};
