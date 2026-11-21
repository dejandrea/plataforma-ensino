import {readSql,learningMigration,id,fixtureUsers} from './learning-test-db.mjs';
import {prepareA02Reconciliation} from './a02-reconciliation-db.mjs';
import {loadPackageTs,validators} from './lesson-package-runtime.mjs';
export const packageLesson=id(9925);
export const syntheticPackageKit={lesson_id:packageLesson,lesson_key:'aula-pacote-local',origin:'https://example.invalid',slots:['principal','revisao','complementar'].map((key,i)=>({key,presentationId:id(9930+i)})),context:{courseTitle:'Aula antiga',moduleTitle:'Aula antiga',submoduleTitle:'Conteúdo'},curriculum:{courseId:id(25),moduleId:id(26),submoduleId:id(27)},lesson:{title:'Aula pacote sintetico',description:null,duration_minutes:null},metadata:null,inventory:[]};
export async function prepareLessonPackages(d){
 await prepareA02Reconciliation(d);await d.login('admin','postgres');
 await d.db.exec(readSql(learningMigration('_editorial_foundation.sql')));
 await d.db.exec(readSql(learningMigration('_unified_lesson_packages.sql')));
 await d.query('insert into lessons(id,module_id,submodule_id,title,order_index) values($1,$2,$3,$4,25)',[packageLesson,id(26),id(27),'Aula pacote sintetico']);
 // Only the synthetic fixture reserves these deterministic IDs, so the delivered
 // example ZIP is directly usable here. Production kits always allocate server IDs.
 await d.query('insert into private.lesson_package_kits(lesson_id,course_id,lesson_key,origin,slots,created_by) values($1,$2,$3,$4,$5,$6)',[packageLesson,id(25),syntheticPackageKit.lesson_key,syntheticPackageKit.origin,JSON.stringify(syntheticPackageKit.slots),fixtureUsers.admin]);
}
export const kitTools=loadPackageTs('src/lib/lessonPackages.ts',{'./supabaseClient':{supabase:{}},'./learningContent':validators,'../contracts/work-lesson-package.md?raw':readSql('src/contracts/work-lesson-package.md')});
