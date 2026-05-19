import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Link } from "react-router-dom";
import { StudentCard } from "../components/StudentCard";

export const TeacherDashboard = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    fetchStudentsData();
    checkUserRole();
  }, []);

  async function checkUserRole() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      setUserRole(data?.role || null);
    }
  }

  async function fetchStudentsData() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("teacher_student_relations")
      .select(
        `
      student:profiles!student_id (
        id,
        full_name,
        avatar_url,
        module_evaluations!module_evaluations_student_id_fkey (id)
      )
    `,
      )
      .eq("teacher_id", user?.id);

    if (error) {
      console.error("Erro na busca de dados:", error);
    } else {
      // Mapeamos para pegar o objeto 'student' de dentro de cada relação
      const formattedStudents = data?.map((item: any) => item.student) || [];
      setStudents(formattedStudents);
    }
    setLoading(false);
  }

  const unlinkStudent = async (studentId: string) => {
    // Confirmar antes de apagar, para evitar cliques acidentais
    const confirmed = window.confirm(
      "Tem certeza que deseja desvincular este aluno da sua lista?",
    );

    if (!confirmed) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("teacher_student_relations")
      .delete()
      .eq("teacher_id", user?.id)
      .eq("student_id", studentId);

    if (error) {
      alert("Erro ao desvincular aluno.");
    } else {
      // Atualiza a lista localmente para o aluno sumir do ecrã na hora
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      alert("Aluno desvinculado com sucesso.");
    }
  };

  if (loading)
    return (
      <div className="p-10 text-center text-blue-600">
        Carregando sua turma...
      </div>
    );

  return (
  <div className="app-bg">
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="relative mb-8 overflow-hidden rounded-3xl bg-white/5 p-6 shadow-soft ring-1 ring-white/10 backdrop-blur md:p-8">
        {/* Glow decor */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-brand-pink/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-brand-lavender/15 blur-3xl" />

        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold italic tracking-tight text-white">
              Painel de Controle <span className="not-italic"></span>
            </h1>

            <p className="mt-2 text-sm font-medium text-white/65">
              {userRole === "admin"
                ? "Administrar do Sistema"
                : "Espaço do Professor"}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

            {/* BOTÃO DE GESTÃO - VISÍVEL APENAS PARA ADMIN */}
            {userRole === "admin" && (
              <Link
                to="/gestao"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/5 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10 active:bg-white/15"
              >
                <span>⚙️</span> Gestão do Sistema
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Grid de Alunos */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {students.map((student) => (
          <StudentCard
            key={student.id}
            student={student}
            onUnlink={unlinkStudent}
          />
        ))}
      </div>
    </div>
  </div>
);
};
