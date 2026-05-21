import { useEffect, useState } from "react";
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

    const { data: studentRows } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "student")
      .order("full_name");

    const { data: teacherRows } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("role", ["professor", "admin"])
      .order("full_name");

    const { data: relationRows } = await supabase.from(
      "teacher_student_relations",
    ).select(`
        teacher_id,
        student_id,
        teacher:profiles!teacher_id(full_name),
        student:profiles!student_id(full_name)
      `);

    setStudents(studentRows || []);
    setTeachers(teacherRows || []);
    setRelations(relationRows || []);
    setLoading(false);
  }

  const handleCreateLink = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedStudent || !selectedTeacher) {
      alert("Selecione ambos.");
      return;
    }

    const { error } = await supabase.from("teacher_student_relations").insert({
      teacher_id: selectedTeacher,
      student_id: selectedStudent,
    });

    if (error) {
      alert(
        error.code === "23505"
          ? "Este aluno ja esta vinculado a esta professora."
          : error.message,
      );
    } else {
      setSelectedStudent("");
      setSelectedTeacher("");
      fetchLinkData();
    }
  };

  const removeLink = async (teacherId: string, studentId: string) => {
    if (!window.confirm("Deseja remover este vinculo de ensino?")) return;

    const { error } = await supabase
      .from("teacher_student_relations")
      .delete()
      .eq("teacher_id", teacherId)
      .eq("student_id", studentId);

    if (!error) {
      fetchLinkData();
    }
  };

  return (
    <div className="grid grid-cols-1 gap-8 animate-in fade-in duration-500 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <form
          onSubmit={handleCreateLink}
          className="sticky top-6 rounded-3xl bg-white/5 p-6 shadow-soft ring-1 ring-white/10 backdrop-blur"
        >
          <h2 className="mb-2 text-lg font-bold italic text-white">
            Criar conexao
          </h2>
          <p className="mb-6 text-xs text-white/40">
            Defina qual professora sera responsavel pelo acompanhamento do
            aluno. Admins tambem podem assumir esse papel.
          </p>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="ml-1 text-[10px] font-black uppercase text-white/30">
                Aluno(a)
              </label>
              <select
                className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 outline-none focus:ring-2 focus:ring-brand-lavender"
                value={selectedStudent}
                onChange={(event) => setSelectedStudent(event.target.value)}
              >
                <option value="" className="bg-gray-900 text-white/50">
                  Selecionar aluno...
                </option>
                {students.map((student) => (
                  <option key={student.id} value={student.id} className="bg-gray-900">
                    {student.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-center py-1">
              <span className="animate-bounce text-xs text-brand-pink">vinculo</span>
            </div>

            <div className="space-y-1">
              <label className="ml-1 text-[10px] font-black uppercase text-white/30">
                Professora ou admin responsavel
              </label>
              <select
                className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 outline-none focus:ring-2 focus:ring-brand-lavender"
                value={selectedTeacher}
                onChange={(event) => setSelectedTeacher(event.target.value)}
              >
                <option value="" className="bg-gray-900 text-white/50">
                  Selecionar professora...
                </option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id} className="bg-gray-900">
                    {teacher.full_name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="mt-4 w-full rounded-2xl bg-gradient-to-r from-brand-magenta to-brand-pink px-4 py-3 text-sm font-extrabold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98]"
            >
              Vincular agora
            </button>
          </div>
        </form>
      </div>

      <div className="lg:col-span-2">
        <h2 className="mb-3 ml-1 text-xs font-semibold uppercase tracking-widest text-white/40">
          Vinculos ativos ({relations.length})
        </h2>

        <div className="overflow-hidden rounded-3xl bg-white/5 shadow-soft ring-1 ring-white/10 backdrop-blur">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-[11px] uppercase text-white/30">
              <tr>
                <th className="px-6 py-4">Aluno</th>
                <th className="px-6 py-4">Responsavel</th>
                <th className="px-6 py-4 text-right">Acao</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {relations.map((relation, index) => (
                <tr key={index} className="group transition hover:bg-white/5">
                  <td className="px-6 py-4 font-bold text-white">
                    {relation.student?.full_name}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-brand-lavender">
                      {relation.teacher?.full_name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() =>
                        removeLink(relation.teacher_id, relation.student_id)
                      }
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
              <span className="text-2xl opacity-20">vinculos</span>
              <p className="mt-2 text-xs italic text-white/30">
                Nenhum vinculo ativo no momento.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
