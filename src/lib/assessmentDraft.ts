import type { AssessmentAnswers, AssessmentSession } from '../types/learning';

export function initialAssessmentAnswers(kind: 'quiz' | 'ordering' | 'matching', session: AssessmentSession): AssessmentAnswers {
  const base: AssessmentAnswers = kind === 'ordering' ? { sequence: [...(session.presentation_json.items ?? [])] } : kind === 'matching' ? { pairs: {} } : {};
  try {
    const stored = localStorage.getItem(`bitaria:attempt:${session.student_id}:${session.id}`);
    if (!stored) return base;
    const draft = JSON.parse(stored);
    if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return base;
    if (kind === 'ordering') {
      const ids = session.presentation_json.items ?? [];
      return Array.isArray(draft.sequence) && draft.sequence.length === ids.length && new Set(draft.sequence).size === ids.length && draft.sequence.every((id: unknown) => typeof id === 'string' && ids.includes(id)) ? { sequence: draft.sequence } : base;
    }
    if (kind === 'matching') {
      const pairs: Record<string, string> = {};
      for (const [left, right] of Object.entries(draft.pairs ?? {})) if ((session.presentation_json.left ?? []).includes(left) && typeof right === 'string' && (session.presentation_json.right ?? []).includes(right) && !Object.values(pairs).includes(right)) pairs[left] = right;
      return { pairs };
    }
    const answers: Record<string, string> = {};
    for (const [key, value] of Object.entries(draft)) if (typeof value === 'string' && session.presentation_json.quiz?.[key]?.includes(value)) answers[key] = value;
    return answers;
  } catch { return base; }
}

export function saveAssessmentDraft(session: AssessmentSession, answers: AssessmentAnswers | null) {
  try {
    const key = `bitaria:attempt:${session.student_id}:${session.id}`;
    if (answers) localStorage.setItem(key, JSON.stringify(answers)); else localStorage.removeItem(key);
  } catch { /* Presentation remains persisted on the server even without local storage. */ }
}
