import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { LessonCard } from "../components/LessonCard";

export const Dashboard = () => {
  const [modules, setModules] = useState<any[]>([]);
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([]);
  const [studentName, setStudentName] = useState("Aluno");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchModules();
  }, []);

  async function fetchModules() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const [{ data, error }, { data: progress }, { data: profile }] = await Promise.all([
      supabase
        .from("modules")
        .select(
          `
            *,
            lessons (*)
          `,
        )
        .order("order_index", { ascending: true })
        .order("order_index", { foreignTable: "lessons", ascending: true }),
      supabase
        .from("student_progress")
        .select("lesson_id")
        .eq("student_id", user.id),
      supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    ]);

    if (error) {
      console.error("Erro ao buscar dados:", error.message);
    } else {
      setModules(data || []);
    }

    setCompletedLessonIds((progress || []).map((item) => item.lesson_id));

    if (profile?.full_name) {
      setStudentName(profile.full_name.split(" ")[0]);
    }

    setLoading(false);
  }

  const totalLessons = modules.reduce(
    (sum, module) => sum + (module.lessons?.length || 0),
    0,
  );
  const completedLessons = modules.reduce(
    (sum, module) =>
      sum +
      (module.lessons?.filter((lesson: any) =>
        completedLessonIds.includes(lesson.id),
      ).length || 0),
    0,
  );

  if (loading) {
    return (
      <div className="app-bg">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-3xl bg-white/5 p-10 text-center text-white/70 ring-1 ring-white/10">
            Carregando sua jornada...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="relative overflow-hidden rounded-3xl bg-white/5 p-6 shadow-soft ring-1 ring-white/10 backdrop-blur md:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-pink/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-brand-lavender/15 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/40">
                Sua area de estudos
              </p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
                Oi, {studentName}. Vamos continuar?
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
                Aqui voce acompanha o que ja concluiu, abre a proxima aula e
                revisita os materiais quando precisar.
              </p>
            </div>

            <Link
              to="/meu-boletim"
              className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
            >
              Ver meu boletim
            </Link>
          </div>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <SummaryCard label="Modulos ativos" value={modules.length} />
          <SummaryCard label="Aulas listadas" value={totalLessons} />
          <SummaryCard label="Aulas concluidas" value={completedLessons} />
        </section>

        <section className="mt-8 space-y-6">
          {modules.length === 0 ? (
            <div className="rounded-3xl bg-white/5 p-10 text-center ring-1 ring-white/10">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
                Em breve
              </p>
              <h2 className="mt-3 text-2xl font-bold text-white">
                Sua jornada ainda nao tem modulos liberados aqui.
              </h2>
              <p className="mt-3 text-sm text-white/60">
                Assim que os conteudos estiverem vinculados ao seu perfil, eles
                aparecem nesta tela.
              </p>
            </div>
          ) : (
            modules.map((module) => (
              (() => {
                const moduleLessons = module.lessons || [];
                const completedModuleLessons = moduleLessons.filter((lesson: any) =>
                  completedLessonIds.includes(lesson.id),
                ).length;
                const moduleProgress = moduleLessons.length
                  ? Math.round((completedModuleLessons / moduleLessons.length) * 100)
                  : 0;

                return (
                  <section
                    key={module.id}
                    className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10 backdrop-blur"
                  >
                <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-lavender">
                      {module.is_locked ? "Modulo bloqueado" : "Modulo liberado"}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold text-white">
                      {module.title}
                    </h2>
                  </div>

                  <div className="w-full max-w-2xl rounded-2xl bg-white/5 px-4 py-4 ring-1 ring-white/10">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                      <div className="flex shrink-0 items-center justify-between gap-3 lg:min-w-[220px]">
                        <span className="font-semibold text-sm text-white/70">
                          {moduleLessons.length} aulas nesta etapa
                        </span>
                        <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-black uppercase tracking-[0.18em] text-brand-ice ring-1 ring-white/10">
                          {moduleProgress}%
                        </span>
                      </div>

                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-brand-900/80 ring-1 ring-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-brand-lavender via-brand-pink to-brand-magenta transition-[width] duration-500"
                            style={{ width: `${moduleProgress}%` }}
                          />
                        </div>

                        <p className="shrink-0 text-xs font-medium text-white/50">
                          {completedModuleLessons}/{moduleLessons.length}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-4">
                  {moduleLessons.map((lesson: any) => {
                    const isCompleted = completedLessonIds.includes(lesson.id);

                    return (
                      <LessonCard
                        key={lesson.id}
                        id={lesson.id}
                        title={lesson.title}
                        type={lesson.video_url ? "video" : "pdf"}
                        isCompleted={isCompleted}
                      />
                    );
                  })}
                </div>
                  </section>
                );
              })()
            ))
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
  <div className="rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
    <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
      {label}
    </p>
    <p className="mt-3 text-3xl font-extrabold text-white">{value}</p>
  </div>
);
