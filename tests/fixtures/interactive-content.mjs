import { readFileSync } from 'node:fs';
import { id } from './learning-test-db.mjs';

export const interactiveDocument = () => JSON.parse(readFileSync('docs/examples/maquinas-interativas.v2.json','utf8'));
export const interactiveLessonId = id(904);
export async function prepareInteractiveContent(database, { publish = true, importContent = true } = {}) {
  const { query,login,rpc } = database;
  const document = interactiveDocument();
  await login('admin','postgres');
  await query('insert into courses values($1,$2,true)',[id(900),document.context.courseTitle]);
  await query('insert into modules values($1,$2,$3,0,true)',[id(901),id(900),document.context.moduleTitle]);
  await query('insert into submodules(id,module_id,is_active,title) values($1,$2,true,$3)',[id(902),id(901),document.context.submoduleTitle]);
  await query('insert into lessons(id,submodule_id,title) values($1,$2,$3)',[interactiveLessonId,id(902),document.lesson.title]);
  await query("insert into achievement_definitions(code,title,description,icon,is_custom) values('custom:historian','Explorador da história','Organizou a linha do tempo.','🏅',true)");
  await query("update xp_reward_rules set points=case event_type when 'activity_interactive' then 15 when 'activity_quiz' then 5 when 'activity_study' then 3 when 'activity_online' then 10 when 'activity_project' then 40 when 'activity_final_project' then 60 when 'submodule_completion' then 7 else points end");
  document.activities[0].gamification.achievementKeys=['custom:historian'];
  if (importContent) {
    await login('admin');
    await rpc('import_learning_lesson',[interactiveLessonId,JSON.stringify(document),publish]);
  }
  await login();
  const snapshot = await rpc('student_lesson_learning',[interactiveLessonId]);
  return { document,lessonId:interactiveLessonId,activities:Object.fromEntries(snapshot.activities.map(a => [a.key,a.id])) };
}
