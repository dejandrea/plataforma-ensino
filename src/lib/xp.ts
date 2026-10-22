export const xpLabels: Record<string, string> = {
  activity_quiz: 'Questionário aprovado',
  activity_interactive: 'Prática interativa aprovada',
  activity_study: 'Estudo autônomo confirmado',
  activity_online: 'Atividade online confirmada pela professora',
  activity_project: 'Miniprojeto aprovado',
  activity_final_project: 'Projeto final aprovado',
  submodule_completion: 'Submódulo concluído',
  learning_activity: 'Recompensa da atividade curricular',
  learning_submodule: 'Recompensa do submódulo',
  welcome: "Boas-vindas à plataforma",
  lesson: "Aula do curso concluída",
  scheduled_lesson: "Aula com a professora concluída",
  module: "Módulo concluído",
  course: "Curso concluído",
  evaluation: "Avaliação recebida",
  evaluation_star: "Cada estrela recebida na avaliação",
  opening: "Saldo anterior",
  mission: "Missão concluída",
};

export type XpRule = { event_type: string; points: number };
export type XpEvent = { event_type: string; source_id: string; title: string; points: number; earned_at: string };

export const combineEvaluationXp = (events: XpEvent[]): XpEvent[] => {
  const stars = new Map(events.filter(event => event.event_type === "evaluation_star")
    .map(event => [event.source_id, event.points]));
  return events.filter(event => event.event_type !== "evaluation_star").map(event =>
    event.event_type === "evaluation"
      ? { ...event, title: "Pontuação da avaliação e das estrelas", points: event.points + (stars.get(event.source_id) || 0) }
      : event);
};

export const evaluationXpRange = (base: number, perStar: number) => ({
  min: base + 8 * perStar,
  max: base + 40 * perStar,
});
