import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { LessonCard } from "../components/LessonCard";

export const Dashboard = () => {
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchModules();
  }, []);

  async function fetchModules() {
    setLoading(true);

    // 1. Pegamos o ID do usuário logado para filtrar o progresso DELE
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    // 2. Query Poderosa: Busca Módulos -> Aulas -> Progresso do Aluno logado
    const { data, error } = await supabase
      .from("modules")
      .select(
        `
      *,
      lessons (
        *,
        student_progress (
          completed_at
        )
      )
    `,
      )
      .eq("lessons.student_progress.student_id", user.id) // Garante que só vemos o NOSSO progresso
      .order("order_index", { ascending: true })
      .order("order_index", { foreignTable: "lessons", ascending: true });

    if (error) {
      console.error("Erro ao buscar dados:", error.message);
    } else {
      console.log("Módulos com progresso:", data);
      setModules(data || []);
    }
    setLoading(false);
  }

  if (loading)
    return <div className="p-10 text-center">Carregando sua jornada... 🛠️</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Olá, Explorador! 🌟
        </h1>
        <p className="text-gray-600">Continue de onde você parou.</p>
      </header>

      <div className="max-w-4xl mx-auto">
        {modules.map((module) => (
          <section key={module.id} className="mb-10">
            <h2 className="text-xl font-bold text-blue-600 mb-4 flex items-center">
              {module.is_locked ? "🔒" : "🔓"} {module.title}
            </h2>

            <div className="grid gap-2">
              {module.lessons.map((lesson: any) => {
                // Se o array de progresso existir e tiver pelo menos 1 item, está concluída!
                const isCompleted =
                  lesson.student_progress && lesson.student_progress.length > 0;

                return (
                  <LessonCard
                    key={lesson.id}
                    id={lesson.id}
                    title={lesson.title}
                    type={lesson.video_url ? "video" : "pdf"}
                    isCompleted={isCompleted} // <--- Passando o valor real aqui!
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
