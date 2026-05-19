import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

export const TabLinks = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [relations, setRelations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState("");

  useEffect(() => {
    fetchLinkData();
  }, []);

  async function fetchLinkData() {
    setLoading(true);
    // 1. Busca Alunos autorizados
    const { data: s } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "student")
      .order("full_name");
      
    // 2. Busca Mentores (Professores e Admins)
    const { data: t } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("role", ["professor", "admin"])
      .order("full_name");
      
    // 3. Busca Vínculos Atuais com Joins para pegar os nomes
    const { data: r } = await supabase.from("teacher_student_relations").select(`
        teacher_id,
        student_id,
        teacher:profiles!teacher_id(full_name),
        student:profiles!student_id(full_name)
      `);

    setStudents(s || []);
    setTeachers(t || []);
    setRelations(r || []);
    setLoading(false);
  }

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedTeacher) return alert("Selecione ambos!");

    const { error } = await supabase
      .from("teacher_student_relations")
      .insert({ teacher_id: selectedTeacher, student_id: selectedStudent });

    if (error) {
      alert(error.code === "23505" ? "Este aluno já está vinculado a esta professora!" : error.message);
    } else {
      setSelectedStudent("");
      setSelectedTeacher("");
      fetchLinkData();
    }
  };

  const removeLink = async (tId: string, sId: string) => {
    if (!window.confirm("Deseja remover este vínculo de ensino?")) return;
    
    const { error } = await supabase
      .from("teacher_student_relations")
      .delete()
      .eq("teacher_id", tId)
      .eq("student_id", sId);

    if (!error) fetchLinkData();
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 animate-in fade-in duration-500">
      {/* FORMULÁRIO DE VÍNCULO */}
      <div className="lg:col-span-1">
        <form
          onSubmit={handleCreateLink}
          className="rounded-3xl bg-white/5 p-6 shadow-soft ring-1 ring-white/10 backdrop-blur sticky top-6"
        >
          <h2 className="mb-2 text-lg font-bold text-white italic">Criar Conexão</h2>
          <p className="mb-6 text-xs text-white/40">Defina qual professora será responsável pelo acompanhamento do aluno.</p>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="ml-1 text-[10px] font-black uppercase text-white/30">Aluno(a)</label>
              <select
                className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 outline-none focus:ring-2 focus:ring-brand-lavender"
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
              >
                <option value="" className="bg-gray-900 text-white/50">Selecionar Aluno...</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id} className="bg-gray-900">{s.full_name}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-center py-1">
              <span className="text-brand-pink animate-bounce text-xs">🔗</span>
            </div>

            <div className="space-y-1">
              <label className="ml-1 text-[10px] font-black uppercase text-white/30">Professor(a) Responsável</label>
              <select
                className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 outline-none focus:ring-2 focus:ring-brand-lavender"
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
              >
                <option value="" className="bg-gray-900 text-white/50">Selecionar Professor...</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id} className="bg-gray-900">{t.full_name}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="mt-4 w-full rounded-2xl bg-gradient-to-r from-brand-magenta to-brand-pink px-4 py-3 text-sm font-extrabold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98]"
            >
              Vincular Agora
            </button>
          </div>
        </form>
      </div>

      {/* TABELA DE VÍNCULOS ATIVOS */}
      <div className="lg:col-span-2">
        <h2 className="ml-1 mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">
          Vínculos Ativos ({relations.length})
        </h2>

        <div className="overflow-hidden rounded-3xl bg-white/5 shadow-soft ring-1 ring-white/10 backdrop-blur">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-[11px] uppercase text-white/30">
              <tr>
                <th className="px-6 py-4">Aluno</th>
                <th className="px-6 py-4">Responsável</th>
                <th className="px-6 py-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {relations.map((rel, idx) => (
                <tr key={idx} className="group transition hover:bg-white/5">
                  <td className="px-6 py-4 font-bold text-white">{rel.student?.full_name}</td>
                  <td className="px-6 py-4">
                    <span className="text-brand-lavender font-medium">
                      {rel.teacher?.full_name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => removeLink(rel.teacher_id, rel.student_id)}
                      className="rounded-xl px-3 py-1 text-[10px] font-black uppercase text-rose-300 transition hover:bg-rose-500/10"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {relations.length === 0 && !loading && (
            <div className="p-12 text-center">
              <span className="text-2xl opacity-20">🏜️</span>
              <p className="mt-2 text-xs italic text-white/30">Nenhum vínculo ativo no momento.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};