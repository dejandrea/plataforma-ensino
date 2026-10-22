import { useAssessmentAttempt } from './useAssessmentAttempt';
import { AssessmentFeedback } from './AssessmentFeedback';
import type { AssessmentAnswers, QuizAttemptRow, QuizContent } from '../../types/learning';

export function QuizActivity({ activityId, content, attempts, disabled, onSubmit, onBusyChange }: {
  activityId: string; content: QuizContent; attempts: QuizAttemptRow[]; disabled: boolean;
  onSubmit: (answers: AssessmentAnswers, sessionId: string) => Promise<QuizAttemptRow>; onBusyChange: (busy: boolean) => void;
}) {
  const attempt = useAssessmentAttempt({ activityId, kind: 'quiz', attempts, disabled, onSubmit, onBusyChange });
  const values = attempt.answers as Record<string, string>;
  const complete = content.questions.every(q => q.options.some(o => o.key === values[q.key]));
  const exhausted = attempt.attemptsUsed >= content.maxAttempts;
  return <div className="space-y-6">
    <p className="text-sm leading-6 text-white/65">Escolha uma alternativa por pergunta. A aprovação exige {content.passingScore} pontos de 100. Você utilizou {attempt.attemptsUsed} de {content.maxAttempts} tentativas.</p>
    {attempt.loading ? <p role="status">Preparando sua tentativa…</p> : <form aria-label="Responder questionário" className="space-y-6" onSubmit={event => { event.preventDefault(); if (complete) void attempt.submit(); }}>
      {(attempt.session || attempt.result) && content.questions.map((question, index) => {
        const feedback = attempt.result?.feedback_json.find(f => f.questionKey === question.key);
        const ids = attempt.presentation.quiz?.[question.key] ?? question.options.map(o => o.key);
        const options = ids.map(id => question.options.find(o => o.key === id)).filter(o => o !== undefined);
        return <fieldset key={question.key} disabled={disabled || attempt.submitting || Boolean(attempt.result) || exhausted} className="space-y-3 rounded-2xl border border-white/10 p-4 md:p-5">
          <legend className="max-w-full px-2 text-base font-bold text-white">{index + 1}. {question.prompt}</legend>
          {options.map(option => <label key={option.key} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm leading-6 ${values[question.key] === option.key ? 'border-brand-purple bg-brand-purple/10 text-white' : 'border-white/10 text-white/70'}`}>
            <input type="radio" name={`${activityId}-${question.key}`} value={option.key} checked={values[question.key] === option.key}
              onChange={() => attempt.change({ ...values, [question.key]: option.key })} className="mt-1 accent-brand-purple" required />
            <span>{option.text}</span>
          </label>)}
          {feedback && <p className="text-sm leading-6 text-white/75"><strong className={feedback.isCorrect ? 'text-emerald-300' : 'text-amber-200'}>{feedback.isCorrect ? 'Resposta correta. ' : 'Revise este conceito. '}</strong>{feedback.feedback}</p>}
        </fieldset>;
      })}
      {attempt.error && <p role="alert" className="rounded-xl bg-red-400/10 p-4 text-sm text-red-200">{attempt.error}</p>}
      {!attempt.session && !attempt.result && attempt.error && <button type="button" onClick={attempt.retry} className="btn-secondary">Tentar carregar tentativa</button>}
      {attempt.session && !attempt.result && !exhausted && <button type="submit" disabled={disabled || attempt.submitting || !complete} className="btn-primary">{attempt.submitting ? 'Corrigindo respostas…' : 'Enviar respostas'}</button>}
    </form>}
    <AssessmentFeedback result={attempt.result} maxAttempts={content.maxAttempts} onRetry={attempt.retry} disabled={disabled || attempt.submitting} noun="Questionário" />
    {attempts.length > 0 && <details className="rounded-2xl border border-white/10 p-4"><summary className="cursor-pointer font-semibold text-white">Histórico de tentativas</summary>
      <ol className="mt-4 space-y-2 text-sm text-white/70">{attempts.map(saved => <li key={saved.id}>Tentativa {saved.attempt_number}: {saved.score}/100 · {saved.passed ? 'Aprovado' : 'Não aprovado'}</li>)}</ol>
    </details>}
  </div>;
}
