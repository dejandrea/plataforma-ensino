import {readSql,learningMigration} from './learning-test-db.mjs';
export const a02Lesson='b17a2000-0000-4000-8000-000000001002';
export const a02Document=()=>JSON.parse(readSql('tests/fixtures/a02-reconciliation.v2.admin.json'));
export async function prepareA02Reconciliation(d){
 await d.login('admin','postgres');
 const context=(await d.query(`select c.title as course,m.title as module,s.title as submodule from lessons l join submodules s on s.id=l.submodule_id join modules m on m.id=s.module_id join courses c on c.id=m.course_id where l.id=$1`,[a02Lesson])).rows[0];
 const old=a02Document();old.context={courseTitle:context.course,moduleTitle:context.module,submoduleTitle:context.submodule};
 old.activities=old.activities.filter(a=>!['video','flashcards'].includes(a.type));
 const order=['a02-v2-arquivos-secretos','a02-v2-associacao-parte1','a02-v2-novas-pistas','a02-v2-seis-descobertas','a02-v2-mapa-grandes-ideias','a02-v2-detetive-tecnologia'];
 const durations=[6,3,6,3,2,5];
 for(const a of old.activities){a.orderIndex=order.indexOf(a.key);a.title='Original '+a.title;a.durationMinutes=durations[a.orderIndex];a.required=a.key!=='a02-v2-seis-descobertas';}
 await d.login('admin');await d.rpc('import_learning_lesson',[a02Lesson,JSON.stringify(old),true]);
 await d.login('admin','postgres');await d.db.exec(readSql(learningMigration('_reconcile_a02_learning_content.sql')));
}
