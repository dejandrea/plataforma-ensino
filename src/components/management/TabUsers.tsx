import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

export const TabUsers = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    lastName: "",
    nickname: "",
    email: "",
    birthDate: "",
    role: "student",
  });

  // Buscar usuários autorizados ao carregar
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) console.error("Erro ao buscar usuários:", error);
    else setUsers(data || []);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // 1. Verificar se o e-mail já existe para evitar duplicatas
    const emailExists = users.some(u => u.email === newUser.email);
    if (emailExists) {
      alert("Este e-mail já está autorizado no sistema!");
      setLoading(false);
      return;
    }

    // 2. Inserir na tabela profiles (Pré-autorização)
    const { error } = await supabase.from("profiles").insert({
      full_name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      is_active: false, // Ficará true após o primeiro login real
    });

    if (error) {
      alert("Erro ao autorizar: " + error.message);
    } else {
      alert("Acesso autorizado com sucesso! 🚀");
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
    if (!window.confirm("Tem certeza que deseja remover esta autorização? O usuário perderá o acesso.")) return;
    
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) alert("Erro ao remover");
    else fetchUsers();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* FORMULÁRIO DE AUTORIZAÇÃO */}
      <section className="rounded-3xl bg-white/5 p-6 shadow-soft ring-1 ring-white/10 backdrop-blur">
        <h2 className="text-xl font-bold text-white italic">Autorizar Novo Acesso</h2>
        <p className="mt-1 text-sm text-white/50">
          O e-mail cadastrado aqui será o único permitido para criar conta.
        </p>

        <form onSubmit={handleCreateUser} className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4  items-end">
          <div className="space-y-1">
            <label className="ml-1 text-[10px] font-black uppercase text-white/30">Nome</label>
            <input
              required
              placeholder="Ex: Ana"
              className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 outline-none transition focus:ring-2 focus:ring-brand-lavender"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            />

            <label className="ml-1 text-[10px] font-black uppercase text-white/30">Sobrenome</label>
            <input
              required
              placeholder="Ex:Silva"
              className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 outline-none transition focus:ring-2 focus:ring-brand-lavender"
              value={newUser.lastName}
                onChange={e => setNewUser({...newUser, lastName: e.target.value})}
            />

            <label className="ml-1 text-[10px] font-black uppercase text-white/30">Apelido</label>
            <input
              placeholder="Aninha"
              className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 outline-none transition focus:ring-2 focus:ring-brand-lavender"
              value={newUser.nickname}
                onChange={e => setNewUser({...newUser, nickname: e.target.value})}
            />
          </div>

          

          <div className="space-y-1">
            <label className="ml-1 text-[10px] font-black uppercase text-white/30">E-mail de Acesso</label>
            <input
              required
              type="email"
              placeholder="ana@email.com"
              className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 outline-none transition focus:ring-2 focus:ring-brand-lavender"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            />

            <label className="ml-1 text-[10px] font-black uppercase text-white/30">Data de Nascimento</label>
            <input
              required
              type="date"
              placeholder="dd/mm/aaaa"
              className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 outline-none transition focus:ring-2 focus:ring-brand-lavender"
              value={newUser.birthDate}
                onChange={e => setNewUser({...newUser, birthDate: e.target.value})}
            />

            <label className="ml-1 text-[10px] font-black uppercase text-white/30">Nível de Acesso</label>
            <select
              className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 outline-none transition focus:ring-2 focus:ring-brand-lavender"
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            >
              <option value="student" className="bg-gray-900">Aluno</option>
              <option value="professor" className="bg-gray-900">Professor(a)</option>
              <option value="admin" className="bg-gray-900">Administrador</option>
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

      {/* LISTAGEM DE USUÁRIOS */}
      <section className="space-y-4">
        <h3 className="ml-1 text-xs font-semibold uppercase tracking-widest text-white/40">
          Usuários com Acesso ({users.length})
        </h3>
        
        <div className="overflow-hidden rounded-3xl bg-white/5 ring-1 ring-white/10 backdrop-blur">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-[11px] uppercase text-white/40">
              <tr>
                <th className="px-6 py-4">Nome</th>
                <th className="px-6 py-4">E-mail</th>
                <th className="px-6 py-4">Cargo</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((user) => (
                <tr key={user.id} className="group transition hover:bg-white/5">
                  <td className="px-6 py-4 font-bold text-white">{user.full_name}</td>
                  <td className="px-6 py-4 text-white/60">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase ring-1 ${
                      user.role === 'admin' ? 'bg-purple-500/10 text-purple-400 ring-purple-400/30' : 
                      user.role === 'professor' ? 'bg-blue-500/10 text-blue-400 ring-blue-400/30' : 
                      'bg-gray-500/10 text-gray-400 ring-white/20'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`h-1.5 w-1.5 rounded-full ${user.is_active ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      <span className="text-[10px] font-medium text-white/50">
                        {user.is_active ? "Ativo" : "Pendente"}
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
            <div className="py-12 text-center text-white/30 italic">Nenhum usuário cadastrado.</div>
          )}
        </div>
      </section>
    </div>
  );
};
