import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {readWeeklyAvailability,legacyWeeklyAvailability,availabilityIntervals} from '../supabase/functions/_shared/weekly-availability.ts';

test('legacy days retain the full window, including all days closed',()=>{
  const value=readWeeklyAvailability(null,[1,6],'07:00','20:00');
  assert.deepEqual(value['1'],[{start:'07:00',end:'20:00'}]);assert.deepEqual(value['2'],[]);
  assert.deepEqual(readWeeklyAvailability(undefined,[],'07:00','20:00')['1'],[]);
  assert.deepEqual(readWeeklyAvailability({},[1,2],'07:00','20:00'),legacyWeeklyAvailability([],'07:00','20:00'));
});
test('afternoons on weekdays and morning on Saturday, with independent split intervals',()=>{
  const data=legacyWeeklyAvailability([1,2,3,4,5],'14:00','20:00');data['6']=[{start:'07:00',end:'09:00'},{start:'14:00',end:'19:00'}];
  const result=availabilityIntervals(data,'07:00','20:00',60);
  assert.deepEqual(result['1'],[{start:840,end:1200}]);assert.deepEqual(result['6'],[{start:420,end:540},{start:840,end:1140}]);assert.deepEqual(result['7'],[]);
});
test('reject malformed times, overlap, undersized intervals and hours outside the window',()=>{
  for(const ranges of [ [{start:'06:00',end:'09:00'}], [{start:'19:00',end:'21:00'}], [{start:'14:00',end:'14:30'}], [{start:'25:00',end:'27:00'}], [{start:'14:00',end:'16:00'},{start:'15:00',end:'18:00'}] ])
    assert.throws(()=>availabilityIntervals({'1':ranges},'07:00','20:00',60));
  for(const value of [[],false,{'8':[]},{'1':'07:00'},{'1':[{start:7,end:'20:00'}]}])assert.throws(()=>readWeeklyAvailability(value,[],'07:00','20:00'));
  for(const minutes of [0,-1,14,60.5,NaN,1441])assert.throws(()=>availabilityIntervals({},'07:00','20:00',minutes));
});
test('adjacent intervals are allowed, sorted without mutating saved data',()=>{
  const data={'1':[{start:'15:00',end:'17:00'},{start:'13:00',end:'15:00'}]},before=structuredClone(data);
  assert.deepEqual(availabilityIntervals(data,'07:00','20:00',60)['1'],[{start:780,end:900},{start:900,end:1020}]);assert.deepEqual(data,before);
});
test('legacy and custom overnight windows remain supported',()=>{
  assert.deepEqual(availabilityIntervals({'6':[{start:'22:00',end:'00:00'}]},'14:00','00:00',60)['6'],[{start:1320,end:1440}]);
  assert.deepEqual(availabilityIntervals({'6':[{start:'23:00',end:'01:00'},{start:'01:00',end:'02:00'}]},'20:00','03:00',60)['6'],[{start:1380,end:1500},{start:1500,end:1560}]);
});
test('migration preserves legacy settings and existing owner RLS for the new column',async()=>{
  const db=new PGlite();try {
    await db.exec(`create role authenticated; create table public.teacher_calendar_settings(teacher_id text primary key, availability_weekdays integer[], availability_start_time text, availability_end_time text); insert into public.teacher_calendar_settings values ('teacher-a',array[1,6],'07:00','20:00'),('teacher-b',array[2],'09:00','17:00'); alter table public.teacher_calendar_settings enable row level security; grant select,update on public.teacher_calendar_settings to authenticated; create policy own_settings on public.teacher_calendar_settings to authenticated using(teacher_id=current_setting('test.actor')) with check(teacher_id=current_setting('test.actor'));`);
    const before=(await db.query('select * from public.teacher_calendar_settings order by teacher_id')).rows;
    await db.exec(readFileSync('supabase/migrations/20261109194229_weekly_availability_intervals.sql','utf8'));
    const after=(await db.query('select * from public.teacher_calendar_settings order by teacher_id')).rows;
    assert.deepEqual(after.map(({availability_weekly_intervals,...rest})=>{assert.equal(availability_weekly_intervals,null);return rest;}),before);
    await db.exec("set role authenticated; set test.actor='teacher-a';");
    assert.equal((await db.query(`update public.teacher_calendar_settings set availability_weekly_intervals='{"1":[{"start":"14:00","end":"20:00"}]}' where teacher_id='teacher-a' returning teacher_id`)).rows.length,1);
    assert.equal((await db.query(`update public.teacher_calendar_settings set availability_weekly_intervals='{}' where teacher_id='teacher-b' returning teacher_id`)).rows.length,0);
    await assert.rejects(db.query(`update public.teacher_calendar_settings set availability_weekly_intervals='[]' where teacher_id='teacher-a'`));
  }finally {await db.close();}
});
