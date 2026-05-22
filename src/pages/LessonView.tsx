import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export const LessonView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchLesson();
    }
  }, [id]);

  async function fetchLesson() {
    const { data, error } = await supabase
      .from("lessons")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Erro do Supabase:", error.message);
    }

    setLesson(data);
  }

  const handleMarkAsComplete = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Voce precisa estar logado.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("student_progress").upsert({
      student_id: user.id,
      lesson_id: id,
      completed_at: new Date().toISOString(),
    });

    if (error) {
      console.error("DETALHE DO ERRO:", error.message, error.details, error.hint);
      alert("Erro ao salvar: " + error.message);
    } else {
      alert("Aula concluida com sucesso.");
      navigate("/dashboard");
    }

    setLoading(false);
  };

  if (!lesson) {
    return (
      <div className="app-bg">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-3xl bg-white/5 p-10 text-center text-white/70 ring-1 ring-white/10">
            Carregando conteudo...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="relative overflow-hidden rounded-3xl bg-white/5 p-6 shadow-soft ring-1 ring-white/10 backdrop-blur md:p-8">
          <div className="pointer-events-none absolute -top-20 right-0 h-64 w-64 rounded-full bg-brand-pink/15 blur-3xl" />

          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-lavender">
                Aula em andamento
              </p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
                {lesson.title}
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/65">
                Assista ao conteudo, revise os materiais de apoio e finalize a
                aula quando terminar.
              </p>
            </div>

            <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/65 ring-1 ring-white/10">
              {lesson.duration_minutes
                ? `${lesson.duration_minutes} min estimados`
                : "Duracao livre"}
            </div>
          </div>
        </header>

        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
          <section className="space-y-8">
            <div className="overflow-hidden rounded-[2rem] bg-black shadow-soft ring-1 ring-white/10">
              <div className="aspect-video">
                {lesson.video_url ? (
                  <iframe
                    className="h-full w-full"
                    src={lesson.video_url.replace("watch?v=", "embed/")}
                    title="Video da aula"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-brand-900 text-center text-sm text-white/60">
                    Esta aula ainda nao possui video disponivel.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
                Sobre esta aula
              </p>
              <p className="mt-4 text-sm leading-7 text-white/70">
                {lesson.description || "Nenhuma descricao adicional foi cadastrada para esta aula."}
              </p>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-lavender">
                Materiais de apoio
              </p>

              <div className="mt-5 space-y-3">
                {lesson.pdf_url && (
                  <a
                    href={lesson.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/10"
                  >
                    Abrir PDF ou slides
                  </a>
                )}

                {lesson.slides_url && (
                  <a
                    href={lesson.slides_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/10"
                  >
                    Abrir apresentacao
                  </a>
                )}

                {lesson.meet_link && (
                  <a
                    href={lesson.meet_link}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/10"
                  >
                    Entrar no encontro
                  </a>
                )}

                {!lesson.pdf_url && !lesson.slides_url && !lesson.meet_link && (
                  <p className="text-sm text-white/55">
                    Nenhum material extra foi anexado para esta aula.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
                Finalizar etapa
              </p>
              <h2 className="mt-3 text-xl font-bold text-white">
                Marque esta aula como concluida quando terminar.
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/60">
                Isso atualiza sua jornada e ajuda a professora a acompanhar o
                seu progresso.
              </p>

              <button
                onClick={handleMarkAsComplete}
                disabled={loading}
                className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-brand-magenta to-brand-pink px-4 py-3 text-sm font-bold text-white shadow-soft ring-1 ring-white/10 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
              >
                {loading ? "Salvando progresso..." : "Concluir aula"}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
