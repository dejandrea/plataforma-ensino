import { useEffect, useRef, useState } from 'react';
import { beginStudentAssessment } from '../../lib/studentLearning';
import { initialAssessmentAnswers, saveAssessmentDraft } from '../../lib/assessmentDraft';
import type { AssessmentAnswers, AssessmentSession, QuizAttemptRow } from '../../types/learning';

export function useAssessmentAttempt({ activityId, kind, attempts, disabled, onSubmit, onBusyChange }: {
  activityId: string; kind: 'quiz' | 'ordering' | 'matching'; attempts: QuizAttemptRow[]; disabled: boolean;
  onSubmit: (answers: AssessmentAnswers, sessionId: string) => Promise<QuizAttemptRow>; onBusyChange: (busy: boolean) => void;
}) {
  const [editing, setEditing] = useState(attempts.length === 0);
  const [session, setSession] = useState<AssessmentSession | null>(null);
  const [answers, setAnswers] = useState<AssessmentAnswers>({});
  const [saved, setSaved] = useState<QuizAttemptRow | null>(null);
  const [error, setError] = useState('');
  const [generation, setGeneration] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const latest = saved && saved.attempt_number >= (attempts.at(-1)?.attempt_number ?? 0) ? saved : attempts.at(-1) ?? null;
  const result = editing ? null : latest;
  const attemptsUsed = latest?.attempt_number ?? 0;

  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    beginStudentAssessment(activityId).then(next => {
      if (!cancelled) { setSession(next); setAnswers(initialAssessmentAnswers(kind, next)); }
    }).catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Não foi possível preparar a tentativa.'); });
    return () => { cancelled = true; };
  }, [activityId, kind, editing, generation]);

  function change(next: AssessmentAnswers) {
    setAnswers(next);
    if (session) saveAssessmentDraft(session, next);
  }
  function retry() { setSession(null); setError(''); setEditing(true); setGeneration(n => n + 1); }
  async function submit() {
    if (inFlight.current || disabled || !session || result) return;
    inFlight.current = true; setSubmitting(true); setError(''); onBusyChange(true);
    try {
      const next = await onSubmit(answers, session.id);
      setSaved(next); setEditing(false); saveAssessmentDraft(session, null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível verificar. Tente novamente.'); }
    finally { inFlight.current = false; setSubmitting(false); onBusyChange(false); }
  }
  return { answers: result?.answers_json ?? answers, change, session, result, attemptsUsed, submitting, error, retry, submit,
    presentation: result?.presentation_json ?? session?.presentation_json ?? {}, loading: editing && !session && !error };
}
