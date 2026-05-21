import { useEffect, useState } from "react";
import { StaffNavbar } from "../components/StaffNavbar";
import { StudentCard } from "../components/StudentCard";
import { supabase } from "../lib/supabaseClient";

export const TeacherDashboard = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudentsData();
  }, []);

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
      const formattedStudents = data?.map((item: any) => item.student) || [];
      setStudents(formattedStudents);
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

  if (loading) {
    return (
      <div className="p-10 text-center text-blue-600">Carregando sua turma...</div>
    );
  }

  return (
    <div className="app-bg min-h-screen">
      <StaffNavbar />

      <div className="mx-auto max-w-6xl px-4 py-8">
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
