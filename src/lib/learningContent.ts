import Ajv from 'ajv';
import schema from '../contracts/learning-content.v1.schema.json';
import schemaV2 from '../contracts/learning-content.v2.schema.json';
import type { LessonImport } from '../types/learning';

const ajv = new Ajv({ allErrors: true, jsonPointers: true });
const validateShape = ajv.compile(schema);
const validateShapeV2 = ajv.compile(schemaV2);
export type ContentValidation = { valid: true; data: LessonImport } | { valid: false; errors: string[] };

/** No coercion, default injection or removal of unknown fields. Input is never mutated. */
export function validateLessonImport(input: unknown): ContentValidation {
  const validator = input && typeof input === 'object' && 'schemaVersion' in input && input.schemaVersion === 2 ? validateShapeV2 : validateShape;
  if (!validator(input)) return { valid: false, errors: (validator.errors ?? []).map(e => `${e.dataPath || '/'}: ${e.message}`) };
  const data = input as LessonImport;
  const errors: string[] = [];
  function unique(keys: string[], path: string) {
    if (new Set(keys).size !== keys.length) errors.push(`${path}: chaves duplicadas`);
  }
  unique(data.activities.map(a => a.key), '/activities');
  unique(data.activities.map(a => String(a.orderIndex)), '/activities/orderIndex');
  const activities = new Map(data.activities.map(a => [a.key, a]));
  for (const activity of data.activities) {
    if (activity.type === 'flashcards') {
      unique(activity.content.cards.map(c=>c.id), `/activities/${activity.key}/cards`);
      for(const card of activity.content.cards)for(const face of [card.front,card.back])if(face.image){
        const url=new URL(face.image.resourceUrl);
        if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443'))errors.push(`/activities/${activity.key}/cards/${card.id}: imagem deve usar HTTPS sem credenciais`);
      }
    }
    if (activity.type === 'video') {
      const url = new URL(activity.content.resourceUrl);
      if (url.hostname !== 'drive.google.com' || url.username || url.password || url.port) {
        errors.push(`/activities/${activity.key}/content/resourceUrl: use um arquivo do Google Drive`);
      }
    }
    for (const prerequisite of activity.prerequisites) {
      if (!activities.has(prerequisite) || prerequisite === activity.key) errors.push(`/activities/${activity.key}: pré-requisito inválido ${prerequisite}`);
    }
    if (activity.type === 'quiz') {
      unique(activity.content.questions.map(q => q.key), `/activities/${activity.key}/questions`);
      for (const question of activity.content.questions) unique(question.options.map(o => o.key), `/questions/${question.key}/options`);
    }
    if (activity.type === 'interactive') {
      const c = activity.content;
      const groups = c.interactionType === 'ordering' ? [c.items] : [c.leftItems, c.rightItems];
      for (const group of groups) unique(group.map(i => i.id), `/activities/${activity.key}/items`);
      if (c.interactionType === 'matching' && c.leftItems.length !== c.rightItems.length) errors.push(`/activities/${activity.key}: lados devem ter o mesmo tamanho`);
    }
    if ('gamification' in activity && activity.gamification) {
      const rules = activity.type === 'quiz' ? ['activity_quiz'] : activity.type === 'interactive' ? ['activity_interactive'] : activity.type === 'online_lesson' ? ['activity_online'] : activity.type === 'project' ? ['activity_project', 'activity_final_project'] : ['activity_study'];
      const awardOn = activity.type === 'project' ? 'approved' : activity.type === 'online_lesson' ? 'teacher_confirmed' : 'completed';
      if (!rules.includes(activity.gamification.rewardRuleKey) || activity.gamification.awardOn !== awardOn) errors.push(`/activities/${activity.key}/gamification: regra incompatível`);
    }
  }
  const visited = new Set<string>();
  const visiting = new Set<string>();
  function visit(key: string) {
    if (visiting.has(key)) { errors.push(`/activities/${key}: ciclo de pré-requisitos`); return; }
    if (visited.has(key)) return;
    visiting.add(key);
    for (const dependency of activities.get(key)?.prerequisites ?? []) visit(dependency);
    visiting.delete(key);
    visited.add(key);
  }
  for (const key of activities.keys()) visit(key);
  unique(data.teacherOnly.quizKeys.map(k => k.activityKey), '/teacherOnly/quizKeys');
  unique(data.teacherOnly.lessonPlans.map(k => k.activityKey), '/teacherOnly/lessonPlans');
  for (const key of data.teacherOnly.quizKeys) {
    const activity = activities.get(key.activityKey);
    if (activity?.type !== 'quiz') { errors.push(`/quizKeys/${key.activityKey}: atividade deve ser quiz`); continue; }
    unique(key.content.answers.map(a => a.questionKey), `/quizKeys/${key.activityKey}/answers`);
    if (key.content.answers.length !== activity.content.questions.length) errors.push(`/quizKeys/${key.activityKey}: gabarito incompleto`);
    for (const answer of key.content.answers) {
      const question = activity.content.questions.find(q => q.key === answer.questionKey);
      if (!question?.options.some(o => o.key === answer.optionKey)) errors.push(`/quizKeys/${key.activityKey}: resposta inválida`);
    }
  }
  for (const activity of data.activities.filter(a => a.type === 'quiz')) {
    if (!data.teacherOnly.quizKeys.some(k => k.activityKey === activity.key)) errors.push(`/quizKeys/${activity.key}: gabarito obrigatório`);
  }
  for (const plan of data.teacherOnly.lessonPlans) {
    if (activities.get(plan.activityKey)?.type !== 'online_lesson') errors.push(`/lessonPlans/${plan.activityKey}: atividade deve ser online_lesson`);
    unique(plan.content.steps.map(s => s.key), `/lessonPlans/${plan.activityKey}/steps`);
  }
  for (const activity of data.activities.filter(a => a.type === 'online_lesson')) {
    if (!data.teacherOnly.lessonPlans.some(p => p.activityKey === activity.key)) errors.push(`/lessonPlans/${activity.key}: plano obrigatório`);
  }
  if (data.schemaVersion === 2) {
    unique(data.teacherOnly.interactiveKeys.map(k => k.activityKey), '/teacherOnly/interactiveKeys');
    for (const entry of data.teacherOnly.interactiveKeys) {
      const a = activities.get(entry.activityKey);
      if (a?.type !== 'interactive' || a.content.interactionType !== entry.content.interactionType) { errors.push(`/interactiveKeys/${entry.activityKey}: subtipo incompatível`); continue; }
      const c = a.content, key = entry.content;
      if (c.interactionType === 'ordering' && key.interactionType === 'ordering') {
        if (key.correctOrder.length !== c.items.length || key.correctOrder.some(id => !c.items.some(i => i.id === id))) errors.push(`/interactiveKeys/${entry.activityKey}: sequência inconsistente`);
      } else if (c.interactionType === 'matching' && key.interactionType === 'matching') {
        unique(key.pairs.map(p => p.leftId), `/interactiveKeys/${entry.activityKey}/left`);
        unique(key.pairs.map(p => p.rightId), `/interactiveKeys/${entry.activityKey}/right`);
        if (key.pairs.length !== c.leftItems.length || key.pairs.some(p => !c.leftItems.some(i => i.id === p.leftId) || !c.rightItems.some(i => i.id === p.rightId))) errors.push(`/interactiveKeys/${entry.activityKey}: associações inconsistentes`);
      }
    }
    for (const a of data.activities.filter(a => a.type === 'interactive')) if (!data.teacherOnly.interactiveKeys.some(k => k.activityKey === a.key)) errors.push(`/interactiveKeys/${a.key}: gabarito obrigatório`);
  }
  return errors.length ? { valid: false, errors } : { valid: true, data };
}

/** Explicit projection; never persist or serve the authoring envelope as student content. */
export function toStudentLesson(input: unknown): Omit<LessonImport, 'teacherOnly'> {
  const result = validateLessonImport(input);
  if (!result.valid) throw new Error(result.errors.join('\n'));
  const { schemaVersion, context, lesson, activities } = result.data;
  return structuredClone({ schemaVersion, context, lesson, activities });
}
