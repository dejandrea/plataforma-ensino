import {EvaluationDetails} from '../components/EvaluationDetails';
import type {PrintableEvaluation} from '../components/EvaluationPrintDocument';
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { evaluationTitle } from "../lib/evaluationPeriods";

export const StudentReport = () => {
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState("");

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

    const { data: student } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    setStudentName(student?.full_name || "Nome não informado");
    const { data, error } = await supabase
      .from("module_evaluations")
      .select(
        `
          *,
          modules (
            title,
            is_active,
            courses ( is_active )
          )
        `,
      )
      .eq("student_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
    } else {
      const visibleEvaluations = (data || []).filter((evaluation) => {
        if (evaluation.reference_month) return true;
        if (!evaluation.modules?.is_active) return false;

        const relatedCourse = Array.isArray(evaluation.modules.courses)
          ? evaluation.modules.courses[0]
          : evaluation.modules.courses;

        return relatedCourse?.is_active === true;
      });

      setEvaluations(visibleEvaluations);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="app-bg">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-3xl bg-surface p-10 text-center text-white/70 ring-1 ring-white/10">
            Abrindo seu boletim...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="relative overflow-hidden rounded-3xl bg-surface p-6 shadow-soft ring-1 ring-white/10 backdrop-blur md:p-8">
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
                Aqui ficam suas avaliações mensais de mentoria e por módulo do curso, com notas, observações e
                feedback consolidado.
              </p>
            </div>

            <div className="rounded-2xl bg-surface px-5 py-4 text-center ring-1 ring-white/10">
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
            <div className="rounded-3xl bg-surface p-10 text-center ring-1 ring-white/10">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
                Nada por aqui ainda
              </p>
              <h2 className="mt-3 text-2xl font-bold text-white">
                Sua primeira avaliacao vai aparecer neste painel.
              </h2>
              <p className="mt-3 text-sm text-white/60">
                Assim que a professora registrar uma avaliação, o resultado fica
                salvo aqui para consulta.
              </p>
            </div>
          ) : (
            <div className="grid gap-8">
              <EvaluationCard evaluation={evaluations[0]} studentName={studentName} />
              {evaluations.length > 1 && (
                <section aria-labelledby="previous-evaluations-title">
                  <h2 id="previous-evaluations-title" className="mb-4 text-xl font-bold text-white">
                    Avaliações anteriores
                  </h2>
                  <div className="space-y-3">
                    {evaluations.slice(1).map((evaluation) => (
                      <details key={evaluation.id} className="group rounded-3xl bg-surface ring-1 ring-white/10">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-3xl p-5 text-white transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-lavender [&::-webkit-details-marker]:hidden">
                          <span className="min-w-0">
                            <span className="block break-words font-bold">{evaluationTitle(evaluation)}</span>
                            <span className="mt-1 block text-xs text-white/50">
                              Registrada em {new Date(evaluation.created_at).toLocaleDateString("pt-BR")}
                            </span>
                          </span>
                          <span aria-hidden="true" className="shrink-0 text-brand-lavender transition-transform group-open:rotate-180">⌄</span>
                        </summary>
                        <div className="px-3 pb-3 sm:px-5 sm:pb-5">
                          <EvaluationCard evaluation={evaluation} studentName={studentName} />
                        </div>
                      </details>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const EvaluationCard = ({ evaluation, studentName }: { evaluation: PrintableEvaluation; studentName: string }) => (
  <EvaluationDetails evaluation={evaluation} studentName={studentName} />
);
