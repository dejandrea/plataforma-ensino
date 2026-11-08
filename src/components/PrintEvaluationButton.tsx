import {useState} from 'react';
import type {PrintableEvaluation} from './EvaluationPrintDocument';

export function PrintEvaluationButton({evaluation, studentName}: {evaluation: PrintableEvaluation; studentName: string}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <div className="my-3 print:hidden">
    <button type="button" className="btn-secondary" disabled={busy} onClick={async () => {
      setBusy(true); setError('');
      try {await (await import('../lib/printEvaluation')).printEvaluation(evaluation, studentName);}
      catch {setError('Não foi possível preparar a impressão. Tente novamente.');}
      finally {setBusy(false);}
    }}>{busy ? 'Preparando impressão…' : 'Imprimir avaliação'}</button>
    {error && <p role="alert" className="mt-2 text-sm text-rose-200">{error}</p>}
  </div>;
}
