export const evaluationCriteria = [
  { id: "technical", label: "Proficiência técnica" },
  { id: "logic", label: "Raciocínio lógico" },
  { id: "creativity", label: "Criatividade" },
  { id: "autonomy", label: "Autonomia" },
  { id: "communication", label: "Comunicação" },
  { id: "organization", label: "Organização e entrega" },
  { id: "engagement", label: "Engajamento e atitude" },
  { id: "patience", label: "Paciência" },
];

export const characterCount = (text: string) => Array.from(text.trim()).length;
export const hasCompleteScores = (scores: Record<string, number>) =>
  evaluationCriteria.every(({ id }) => Number.isInteger(scores[id]) && scores[id] >= 1 && scores[id] <= 5);

export const averageOutOfTen = (scores: Record<string, number>) =>
  hasCompleteScores(scores)
    ? evaluationCriteria.reduce((sum, { id }) => sum + scores[id], 0) / evaluationCriteria.length * 2
    : null;

export function isValidFeedback(value: unknown, generated = false): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const feedback = value as Record<string, unknown>;
  const general = feedback.general;
  return typeof general === "string" && characterCount(general) >= 250 && characterCount(general) <= 400 &&
    evaluationCriteria.every(({ id }) => typeof feedback[id] === "string" &&
      characterCount(feedback[id] as string) >= (generated ? 70 : 1) && characterCount(feedback[id] as string) <= 100);
}
