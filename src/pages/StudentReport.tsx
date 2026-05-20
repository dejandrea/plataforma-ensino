import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { BackLink } from "../components/BackLink";

const criteriaLabels: Record<string, string> = {
  score_technical: "Tech",
  score_logic: "Logica",
  score_creativity: "Criatividade",
  score_autonomy: "Autonomia",
  score_communication: "Troca",
  score_organization: "Organizacao",
  score_engagement: "Atitude",
  score_patience: "Paciencia",
};

export const StudentReport = () => {
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyEvaluations();
  }, []);

  async function fetchMyEvaluations() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("module_evaluations")
      .select(
        `
          *,
          modules ( title )
        `,
      )
      .eq("student_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setEvaluations(data || []);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="app-bg">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-3xl bg-white/5 p-10 text-center text-white/70 ring-1 ring-white/10">
            Abrindo seu boletim...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <BackLink to="/dashboard" label="Voltar para a jornada" />

        <header className="relative overflow-hidden rounded-3xl bg-white/5 p-6 shadow-soft ring-1 ring-white/10 backdrop-blur md:p-8">
          <div className="pointer-events-none absolute -right-24 top-0 h-72 w-72 rounded-full bg-brand-pink/15 blur-3xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/40">
                Seu acompanhamento
              </p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
                Meu boletim
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
                Aqui ficam suas avaliacoes por modulo, com notas, observacoes e
                feedback consolidado.
              </p>
            </div>

            <div className="rounded-2xl bg-white/5 px-5 py-4 text-center ring-1 ring-white/10">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
                Avaliacoes
              </p>
              <p className="mt-2 text-3xl font-extrabold text-white">
                {evaluations.length}
              </p>
            </div>
          </div>
        </header>

        <section className="mt-8">
          {evaluations.length === 0 ? (
            <div className="rounded-3xl bg-white/5 p-10 text-center ring-1 ring-white/10">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
                Nada por aqui ainda
              </p>
              <h2 className="mt-3 text-2xl font-bold text-white">
                Sua primeira avaliacao vai aparecer neste painel.
              </h2>
              <p className="mt-3 text-sm text-white/60">
                Assim que um modulo for finalizado e avaliado, o resultado fica
                salvo aqui para consulta.
              </p>
            </div>
          ) : (
            <div className="grid gap-8">
              {evaluations.map((evaluation) => (
                <EvaluationCard key={evaluation.id} evaluation={evaluation} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const EvaluationCard = ({ evaluation }: { evaluation: any }) => {
  const feedbackEntries =
    evaluation.ai_feedback_json &&
    typeof evaluation.ai_feedback_json === "object" &&
    !("error" in evaluation.ai_feedback_json)
      ? Object.values(evaluation.ai_feedback_json)
      : [];

  const shouldUseTeacherFallback = feedbackEntries.length === 0;

  return (
    <article className="overflow-hidden rounded-[2rem] bg-white/5 shadow-soft ring-1 ring-white/10">
      <div className="bg-gradient-to-r from-brand-purple/80 to-brand-pink/80 p-5 text-white">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
              Modulo avaliado
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              {evaluation.modules?.title || "Modulo"}
            </h2>
          </div>

          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/15">
            {new Date(evaluation.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="space-y-6 p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Object.entries(criteriaLabels).map(([key, label]) => (
            <div
              key={key}
              className="rounded-2xl bg-white/5 p-4 text-center ring-1 ring-white/10"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">
                {label}
              </p>
              <p className="mt-2 text-lg font-bold text-brand-ice">
                {Number(evaluation[key] || 0)}/5
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-3xl bg-brand-lavender/10 p-5 ring-1 ring-brand-lavender/20">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-ice/70">
            {shouldUseTeacherFallback
              ? "Feedback da professora"
              : "Feedback consolidado"}
          </p>

          <div className="mt-4 space-y-3 text-sm leading-7 text-brand-ice">
            {shouldUseTeacherFallback ? (
              <p>
                {evaluation.teacher_comment ||
                  "Nenhum comentario adicional foi registrado."}
              </p>
            ) : (
              feedbackEntries.map((text, index) => <p key={index}>{String(text)}</p>)
            )}
          </div>
        </div>

        <div className="rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
            Comentario da professora
          </p>
          <p className="mt-4 text-sm leading-7 text-white/75">
            {evaluation.teacher_comment || "Nenhum comentario adicional foi registrado."}
          </p>
        </div>
      </div>
    </article>
  );
};
