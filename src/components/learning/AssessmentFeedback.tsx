import type { QuizAttemptRow } from '../../types/learning';

export function AssessmentFeedback({ result, maxAttempts, onRetry, disabled, noun = 'Atividade' }: {
  result: QuizAttemptRow | null; maxAttempts: number; onRetry: () => void; disabled: boolean; noun?: string;
}) {
  if (!result) return null;
  const exhausted = result.attempt_number >= maxAttempts;
  return <div className="space-y-4">
    <div role="status" className="rounded-2xl bg-white/5 p-5">
      <p className="text-lg font-bold text-white">{result.passed ? `${noun} aprovad${noun === 'Questionário' ? 'o' : 'a'}!` : 'Continue praticando'} · {result.score}/100</p>
      <p className="mt-2 text-sm text-white/65">Tentativa {result.attempt_number} salva. {result.passed ? 'Sua conclusão foi registrada.' : exhausted ? 'Limite de tentativas atingido. Converse com sua professora.' : 'Revise o feedback antes de tentar novamente.'}</p>
    </div>
    {!result.passed && !exhausted && <button type="button" disabled={disabled} onClick={onRetry} className="btn-secondary">Tentar novamente</button>}
  </div>;
}
