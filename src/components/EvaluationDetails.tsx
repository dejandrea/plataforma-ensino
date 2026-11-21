import {PrintEvaluationButton} from './PrintEvaluationButton';
import { evaluationTitle } from "../lib/evaluationPeriods";
import {evaluationCriteria} from '../lib/evaluationDraft';
import {EvaluationStars} from './EvaluationStars';
import {evaluationMascot, type PrintableEvaluation} from './EvaluationPrintDocument';
import logo from '../assets/logo/logo-horizontal-para-fundo-escuro.png';
import './evaluationJourney.css';

export const EvaluationDetails = ({ evaluation, studentName }: { evaluation: PrintableEvaluation; studentName: string }) => {
  const feedback = evaluation.ai_feedback_json;
  return (
    <article className="overflow-hidden rounded-2xl bg-brand-900/40 ring-1 ring-white/10">
      <header className="evaluation-digital-head bg-brand-lavender/10 p-5 md:p-6">
        <img src={logo} alt="Bitaria" className="mb-2 w-36" />
        <p className="mb-4 text-xs text-white/70">Aprenda. Crie. Evolua.</p>
        <img className="evaluation-digital-bitara" src={evaluationMascot} alt="Bitara sorrindo, com um braço levantado em sinal de vitória." />
        <p className="text-xs font-bold uppercase tracking-widest text-brand-lavender">Somente leitura</p>
        <h2 className="mt-2 text-2xl font-bold text-white">Minha jornada de evolução</h2>
        <p className="mt-2 text-lg font-bold text-white">{studentName}</p>
        <h3 className="mt-2 text-xl font-bold text-white">{evaluationTitle(evaluation)}</h3>
        <p className="mt-2 text-sm text-white/50">
          Registrada em {evaluation.created_at ? new Date(evaluation.created_at).toLocaleDateString("pt-BR") : 'Não informada'}
        </p>
      </header>
      <div className="space-y-6 p-5 md:p-6">
        <PrintEvaluationButton evaluation={evaluation} studentName={studentName} />
        <dl className="grid gap-3 sm:grid-cols-2">
          {evaluationCriteria.map(({id: key, label}) => (
            <div key={key} className="rounded-xl bg-surface p-4 ring-1 ring-white/10">
              <dt className="text-sm text-white/60">{label}</dt>
              <dd className="evaluation-digital-stars mt-2"><EvaluationStars value={evaluation[`score_${key}`]} /></dd>
              {typeof feedback?.[key] === "string" && (
                <dd className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-white/75">{feedback[key]}</dd>
              )}
            </div>
          ))}
        </dl>
        {typeof feedback?.general === "string" && (
          <section aria-label="Avaliação geral" className="evaluation-digital-message rounded-xl p-5 ring-1 ring-brand-lavender/30">
            <h4 className="text-xl font-bold text-white">Sua evolução merece destaque!</h4>
            <p className="mt-1 text-sm text-white/70">Uma mensagem especial sobre sua jornada</p>
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
