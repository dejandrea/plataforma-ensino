import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLearningTestDb,learningMigration,readSql,fixtureUsers} from './fixtures/learning-test-db.mjs';

test('profile access guard permits service writes without granting learning_role; client privilege escalation remains blocked',async t=>{
 const d=await createLearningTestDb();t.after(()=>d.db.close());const {db,login,query}=d;
 await login('admin','postgres');
 await query("update profiles set nickname='Antes' where id=$1",[fixtureUsers.student]);
 await login('admin','service_role');
 // Reproduce the exact failing database role used by update-platform-user.
 await assert.rejects(query('update profiles set nickname=$1 where id=$2',['Servidor',fixtureUsers.student]),/permission denied for function learning_role/);
 await login('admin','postgres');
 await db.exec(readSql(learningMigration('_fix_learning_profile_service_permissions.sql')));
 await db.exec(readSql(learningMigration('_fix_learning_profile_service_permissions.sql')));
 await login('admin','service_role');
 await query('update profiles set nickname=$1,student_service_scope=$2 where id=$3',['Servidor','both',fixtureUsers.student]);
 assert.equal((await query('select nickname from profiles where id=$1',[fixtureUsers.student])).rows[0].nickname,'Servidor');
 assert.equal((await query("select has_function_privilege('service_role','private.learning_role()','execute') allowed")).rows[0].allowed,false);
 for(const user of ['student','teacher']) {
  await login(user);
  await assert.rejects(query("update profiles set role='admin' where id=$1",[fixtureUsers[user]]),/Somente administradores/);
  await assert.rejects(query("update profiles set is_active=false where id=$1",[fixtureUsers[user]]),/Somente administradores/);
  await assert.rejects(query("update profiles set student_service_scope='mentoring' where id=$1",[fixtureUsers[user]]),/Somente administradores/);
  await query('update profiles set nickname=$1 where id=$2',['Nome editável',fixtureUsers[user]]);
 }
 await login('inactive');
 await assert.rejects(query('update profiles set is_active=true where id=$1',[fixtureUsers.inactive]),/Somente administradores/);
 await login('admin');
 await query('update profiles set student_service_scope=$1 where id=$2',['both',fixtureUsers.admin]);
 await login('admin','postgres');
 assert.equal((await query("select prosecdef from pg_proc where oid='private.learning_guard_profile_access()'::regprocedure")).rows[0].prosecdef,false);
 assert.equal((await query("select has_function_privilege('anon','private.learning_role()','execute') allowed")).rows[0].allowed,false);
});
