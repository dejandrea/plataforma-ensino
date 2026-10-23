export const xpLabels: Record<string, string> = {
  profile_exemplar:'Perfil Exemplar',networking:'Mestre do Networking',instagram:'Instagrameiro',dedication_month:'Dedicação Total (mês)',engagement_week:'Super Engajado (semana)',dedication_bonus:'Bônus por 12 Dedicação Total',engagement_bonus:'Bônus por 12 Super Engajado',
  official_profile:'Conquista de perfil',official_engagement:'Conquista de frequência',official_engagement_bonus:'Bônus de frequência',
  activity_quiz: 'Primeira tentativa do questionário',
  activity_interactive: 'Prática interativa aprovada',
  activity_study: 'Estudo autônomo confirmado',
  activity_online: 'Atividade online confirmada pela professora',
  activity_project: 'Envio válido de miniprojeto',
  activity_final_project: 'Envio válido de projeto',
  project_submission: 'Envio de projeto ou miniprojeto',
  project_evaluation: 'Nota do projeto ou miniprojeto',
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

export type XpRule = { event_type: string; points: number; calculation?: 'fixed' | 'first_quiz_score' | 'project_grade'; is_official?: boolean };
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
