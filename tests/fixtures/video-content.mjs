import {readFileSync} from 'node:fs';
import {id} from './learning-test-db.mjs';

export const videoDocument=()=>JSON.parse(readFileSync('docs/examples/video-html.v2.json','utf8'));
export const videoLessonId=id(9803);
export async function prepareVideoLesson(d,document=videoDocument()) {
  await d.login('admin','postgres');
  await d.query('insert into courses values($1,$2,true)',[id(9800),document.context.courseTitle]);
  await d.query('insert into modules values($1,$2,$3,0,true)',[id(9801),id(9800),document.context.moduleTitle]);
  await d.query('insert into submodules(id,module_id,is_active,title) values($1,$2,true,$3)',[id(9802),id(9801),document.context.submoduleTitle]);
  await d.query('insert into lessons(id,submodule_id,title) values($1,$2,$3)',[videoLessonId,id(9802),document.lesson.title]);
  await d.login('admin');
  return {document,lessonId:videoLessonId};
}
