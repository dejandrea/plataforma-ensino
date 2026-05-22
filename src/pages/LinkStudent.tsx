import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export const LinkStudent = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    const { data: studentsData } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "student")
      .order("full_name");

    const { data: teachersData } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("role", ["professor", "admin"])
      .order("full_name");

    setStudents(studentsData || []);
    setTeachers(teachersData || []);
  }

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStudent || !selectedTeacher) {
      setMessage({ text: "Selecione ambos para vincular.", type: "error" });
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("teacher_student_relations").insert({
      teacher_id: selectedTeacher,
      student_id: selectedStudent,
    });

    if (error) {
      if (error.code === "23505") {
        setMessage({ text: "Este vinculo ja existe.", type: "error" });
      } else {
        setMessage({
          text: "Erro ao vincular: " + error.message,
          type: "error",
        });
      }
    } else {
      setMessage({ text: "Vinculo criado com sucesso.", type: "success" });
      setSelectedStudent("");
      setSelectedTeacher("");
    }

    setLoading(false);
  };

  return (
    <div className="app-bg min-h-screen p-8 text-white">
      <div className="mx-auto max-w-2xl">
        <header className="mb-10">
          <h1 className="text-4xl font-black italic">
            Vincular aluno e professora responsavel
          </h1>
          <p className="mt-2 text-white/55">
            Defina quem sera a professora responsavel por cada aluno. Admins
            tambem podem assumir esse papel.
          </p>
        </header>

        <form
          onSubmit={handleLink}
          className="space-y-6 rounded-3xl bg-white/5 p-8 shadow-soft ring-1 ring-white/10"
        >
          <div>
            <label className="ml-1 text-xs font-black uppercase tracking-widest text-white/35">
              Selecionar aluno
            </label>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="mt-2 w-full rounded-2xl bg-brand-900/60 p-4 text-white ring-1 ring-white/10 outline-none transition focus:ring-2 focus:ring-brand-lavender"
            >
              <option value="">Escolha um aluno...</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-center py-2 text-brand-lavender/50">
            <span className="text-2xl">v</span>
          </div>

          <div>
            <label className="ml-1 text-xs font-black uppercase tracking-widest text-white/35">
              Professora ou admin responsavel
            </label>
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="mt-2 w-full rounded-2xl bg-brand-900/60 p-4 text-white ring-1 ring-white/10 outline-none transition focus:ring-2 focus:ring-brand-lavender"
            >
              <option value="">Escolha a professora...</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.full_name}
                </option>
              ))}
            </select>
          </div>

          {message.text && (
            <div
              className={`rounded-2xl p-4 text-center text-sm font-bold ${
                message.type === "success"
                  ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-400/20"
                  : "bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/20"
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gradient-to-r from-brand-purple to-brand-pink p-5 text-sm font-black uppercase tracking-widest text-white shadow-soft transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "Processando..." : "Confirmar vinculo"}
          </button>
        </form>
      </div>
    </div>
  );
};
