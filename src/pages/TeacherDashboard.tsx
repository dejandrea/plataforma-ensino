import { useEffect, useMemo, useState } from "react";
import { StudentCard } from "../components/StudentCard";
import { supabase } from "../lib/supabaseClient";

export const TeacherDashboard = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>("professor");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchStudentsData();
  }, []);

  async function fetchStudentsData() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const currentRole = profile?.role || "professor";
    setUserRole(currentRole);

    const relationsQuery = supabase.from("teacher_student_relations").select(
      `
        teacher_id,
        student:profiles!student_id (
          id,
          full_name,
          avatar_url,
          avatar_mode,
          avatar_preset,
          module_evaluations!module_evaluations_student_id_fkey (id)
        ),
        teacher:profiles!teacher_id (
          id,
          full_name
        )
      `,
    );

    const { data, error } =
      currentRole === "admin"
        ? await relationsQuery
        : await relationsQuery.eq("teacher_id", user.id);

    if (error) {
      console.error("Erro na busca de alunos:", error);
      setStudents([]);
    } else {
      const uniqueStudents = new Map<string, any>();

      for (const item of data || []) {
        const student = Array.isArray(item.student) ? item.student[0] : item.student;

        if (student?.id && !uniqueStudents.has(student.id)) {
          uniqueStudents.set(student.id, student);
        }
      }

      setStudents(Array.from(uniqueStudents.values()));
    }

    setLoading(false);
  }

  const unlinkStudent = async (studentId: string) => {
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
      setStudents((prev) => prev.filter((student) => student.id !== studentId));
      alert("Aluno desvinculado com sucesso.");
    }
  };
  const totalStudents = students.length;
  const studentsWithEvaluations = useMemo(
    () =>
      students.filter(
        (student) =>
          Array.isArray(student.module_evaluations) && student.module_evaluations.length > 0,
      ).length,
    [students],
  );

  if (loading) {
    return (
      <div className="app-bg min-h-screen">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="rounded-3xl bg-white/5 p-10 text-center text-white/70 ring-1 ring-white/10">
            Carregando painel da turma...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="relative overflow-hidden rounded-3xl bg-white/5 p-6 shadow-soft ring-1 ring-white/10 backdrop-blur md:p-8">
          <div className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full bg-brand-pink/15 blur-3xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/40">
                {userRole === "admin" ? "Painel da gestao" : "Painel da professora"}
              </p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
                Acompanhamento da turma
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">
                Gerencie os alunos vinculados a voce e acompanhe a organizacao da
                turma a partir deste painel principal.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryCard label="Alunos" value={totalStudents} />
              <SummaryCard label="Com avaliacoes" value={studentsWithEvaluations} />
            </div>
          </div>
        </header>

        <section className="mt-8">
          {students.length === 0 ? (
            <EmptyState
              title="Nenhum aluno vinculado ainda"
              description="Assim que a turma estiver vinculada, os cards dos alunos vao aparecer aqui."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {students.map((student) => (
                <StudentCard
                  key={student.id}
                  student={student}
                  onUnlink={unlinkStudent}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const SummaryCard = ({
  label,
  value,
}: {
  label: string;
  value: number;
}) => (
  <div className="rounded-2xl bg-white/5 px-5 py-4 text-center ring-1 ring-white/10">
    <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
      {label}
    </p>
    <p className="mt-2 text-3xl font-extrabold text-white">{value}</p>
  </div>
);

const EmptyState = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => (
  <div className="rounded-3xl bg-white/5 p-10 text-center ring-1 ring-white/10">
    <h2 className="text-2xl font-bold text-white">{title}</h2>
    <p className="mt-3 text-sm text-white/60">{description}</p>
  </div>
);
