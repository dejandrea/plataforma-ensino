import { evaluationTitle } from "../lib/evaluationPeriods";

const criteria = [
  ["technical", "Proficiência técnica"],
  ["logic", "Raciocínio lógico"],
  ["creativity", "Criatividade"],
  ["autonomy", "Autonomia"],
  ["communication", "Comunicação"],
  ["organization", "Organização e entrega"],
  ["engagement", "Engajamento e atitude"],
  ["patience", "Paciência"],
];

export const EvaluationDetails = ({ evaluation }: { evaluation: any }) => {
  const feedback = evaluation.ai_feedback_json;
  return (
    <article className="overflow-hidden rounded-2xl bg-brand-900/40 ring-1 ring-white/10">
      <header className="bg-brand-lavender/10 p-5 md:p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-lavender">Somente leitura</p>
        <h3 className="mt-2 text-xl font-bold text-white">{evaluationTitle(evaluation)}</h3>
        <p className="mt-2 text-sm text-white/50">
          Registrada em {new Date(evaluation.created_at).toLocaleDateString("pt-BR")}
        </p>
      </header>
      <div className="space-y-6 p-5 md:p-6">
        <dl className="grid gap-3 sm:grid-cols-2">
          {criteria.map(([key, label]) => (
            <div key={key} className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
              <dt className="text-sm text-white/60">{label}</dt>
              <dd className="mt-2 text-lg font-bold text-brand-ice">{evaluation[`score_${key}`] ?? "—"}/5</dd>
              {typeof feedback?.[key] === "string" && (
                <dd className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-white/75">{feedback[key]}</dd>
              )}
            </div>
          ))}
        </dl>
        {typeof feedback?.general === "string" && (
          <section className="rounded-xl bg-white/5 p-5 ring-1 ring-white/10">
            <h4 className="text-sm font-bold text-white">Avaliação geral</h4>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-white/75">{feedback.general}</p>
          </section>
        )}
        {(!feedback?.general || evaluation.teacher_comment !== feedback.general) && <section className="rounded-xl bg-brand-lavender/10 p-5 ring-1 ring-brand-lavender/20">
          <h4 className="text-sm font-bold text-white">Comentário da professora</h4>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-white/75">
            {evaluation.teacher_comment || "Sem comentário registrado."}
          </p>
        </section>}
      </div>
    </article>
  );
};
