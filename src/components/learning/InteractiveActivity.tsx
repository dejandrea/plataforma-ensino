import { useAssessmentAttempt } from './useAssessmentAttempt';
import { AssessmentFeedback } from './AssessmentFeedback';
import { useState } from 'react';
import type { AssessmentAnswers, InteractiveContent, QuizAttemptRow } from '../../types/learning';

export function InteractiveActivity({ activityId, content, attempts, disabled, onSubmit, onBusyChange }: {
  activityId: string; content: InteractiveContent; attempts: QuizAttemptRow[]; disabled: boolean;
  onSubmit: (answers: AssessmentAnswers, sessionId: string) => Promise<QuizAttemptRow>; onBusyChange: (busy: boolean) => void;
}) {
  const a = useAssessmentAttempt({ activityId, kind: content.interactionType, attempts, disabled, onSubmit, onBusyChange });
  const [movement, setMovement] = useState('');
  const sequence = 'sequence' in a.answers && Array.isArray(a.answers.sequence) ? a.answers.sequence : a.presentation.items ?? [];
  const pairs: Record<string, string> = 'pairs' in a.answers && typeof a.answers.pairs === 'object' ? a.answers.pairs : {};
  const locked = disabled || a.submitting || Boolean(a.result);
  const complete = content.interactionType === 'ordering' ? sequence.length === content.items.length : content.leftItems.every(i => Boolean(pairs[i.id]));
  function move(index: number, offset: number) {
    const next = [...sequence]; [next[index], next[index + offset]] = [next[index + offset], next[index]];
    a.change({ sequence: next });
    if (content.interactionType === 'ordering') setMovement(`${content.items.find(i => i.id === sequence[index])?.label}: posição ${index + offset + 1}.`);
  }
  return <div className="space-y-5">
    <p className="whitespace-pre-wrap text-sm leading-7 text-white/75">{content.instructions}</p>
    <p className="text-sm text-white/65">Nota mínima: {content.passingScore}/100 · {a.attemptsUsed} de {content.maxAttempts} tentativas utilizadas.</p>
    {a.loading ? <p role="status">Preparando sua tentativa…</p> : <form className="space-y-5" aria-label={content.interactionType === 'ordering' ? 'Ordenar itens' : 'Associar elementos'} onSubmit={event => { event.preventDefault(); if (complete) void a.submit(); }}>
      {(a.session || a.result) && (content.interactionType === 'ordering' ? <>
        <p className="text-xs text-white/65">Use os botões para mover cada card. Você também pode navegar com Tab e ativar os botões com Enter ou Espaço.</p>
        <p role="status" className="sr-only">{movement}</p><ol aria-label="Sequência de itens" className="space-y-3">{sequence.map((id, index) => {
          const item = content.items.find(i => i.id === id);
          return <li key={id} data-item-id={id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/5 p-4">
            <span className="min-w-0 break-words text-sm font-semibold text-white">{index + 1}. {item?.label}</span>
            <span className="flex shrink-0 gap-2"><button type="button" disabled={locked || index === 0} aria-label={`Mover ${item?.label} para cima`} onClick={() => move(index, -1)} className="btn-secondary px-3">↑</button>
              <button type="button" disabled={locked || index === sequence.length - 1} aria-label={`Mover ${item?.label} para baixo`} onClick={() => move(index, 1)} className="btn-secondary px-3">↓</button></span>
          </li>;
        })}</ol>
      </> : <div className="space-y-4">{(a.presentation.left ?? content.leftItems.map(i => i.id)).map(id => {
        const item = content.leftItems.find(i => i.id === id);
        const options = (a.presentation.right ?? content.rightItems.map(i => i.id)).map(key => content.rightItems.find(i => i.id === key)).filter(i => i !== undefined);
        return <label key={id} className="block rounded-2xl border border-white/15 p-4"><span className="mb-3 block font-bold text-white">{item?.label}</span>
          <select aria-label={`Associar ${item?.label}`} value={pairs[id] ?? ''} disabled={locked} required className="min-h-11 w-full rounded-xl bg-background p-3 text-sm text-white ring-1 ring-white/20" onChange={event => {
            const next = { ...pairs }; if (event.target.value) next[id] = event.target.value; else delete next[id]; a.change({ pairs: next });
          }}><option value="">Selecione uma definição</option>{options.map(option => <option key={option.id} value={option.id} disabled={pairs[id] !== option.id && Object.values(pairs).includes(option.id)}>{option.label}</option>)}</select>
        </label>;
      })}</div>)}
      {a.error && <p role="alert" className="text-sm text-red-200">{a.error}</p>}
      {!a.session && !a.result && a.error && <button type="button" onClick={a.retry} className="btn-secondary">Tentar carregar tentativa</button>}
      {a.session && !a.result && <button type="submit" disabled={locked || !complete} className="btn-primary">{a.submitting ? 'Verificando…' : 'Verificar resposta'}</button>}
    </form>}
    {a.result && <div className="space-y-2 text-sm text-white/75">
      {content.interactionType === 'matching' && <ul>{a.result.feedback_json.map(f => <li key={f.questionKey}>{content.leftItems.find(i => i.id === f.questionKey)?.label}: {f.isCorrect ? 'associação correta' : 'revise esta associação'}</li>)}</ul>}
      {[...new Set(a.result.feedback_json.map(f => f.feedback))].map(message => <p key={message}>{message}</p>)}
    </div>}
    <AssessmentFeedback result={a.result} maxAttempts={content.maxAttempts} onRetry={a.retry} disabled={disabled || a.submitting} />
  </div>;
}
