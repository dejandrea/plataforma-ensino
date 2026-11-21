import {DateTime,Settings} from 'npm:luxon@3.7.1';
import {readWeeklyAvailability,availabilityIntervals} from '../supabase/functions/_shared/weekly-availability.ts';

const assert=(value:unknown,message='Assertion failed')=>{if(!value)throw new Error(message);};
const same=(a:unknown,b:unknown)=>assert(JSON.stringify(a)===JSON.stringify(b),`${JSON.stringify(a)} != ${JSON.stringify(b)}`);
const template={teacher_id:'teacher',is_active:true,connection_status:'connected',availability_calendar_ids:['synthetic-calendar'],timezone:'America/Bahia',availability_weekdays:[1,2,3,4,5],availability_start_time:'07:00',availability_end_time:'20:00',availability_slot_minutes:60,availability_horizon_days:7};
const weekly={...Object.fromEntries([1,2,3,4,5].map(d=>[d,[{start:'14:00',end:'16:00'}]])),6:[{start:'07:00',end:'09:00'},{start:'14:00',end:'16:00'}],7:[]};
const source=await Deno.readTextFile(new URL('../supabase/functions/google-calendar-sync-availability/index.ts',import.meta.url));
let count=0;
async function run({settings={...template,availability_weekly_intervals:weekly},role='professor',relation=true,body={},lessons=[],busy=[],googleError=false,calendarErrors=false,now='2026-11-09T05:00:00-03:00'}:any={}) {
  let handler:any;const rows:any[]=structuredClone(lessons);let writes=0,tokenCalls=0;
  const client={from(table:string){let action='',payload:any,conditions:((r:any)=>boolean)[]=[];
    const q:any={select:()=>q,eq:(k:string,v:any)=>{conditions.push(r=>r[k]===v);return q;},in:(k:string,v:any[])=>{conditions.push(r=>v.includes(r[k]));return q;},gt:(k:string,v:any)=>{conditions.push(r=>r[k]>v);return q;},lte:(k:string,v:any)=>{conditions.push(r=>r[k]<=v);return q;},delete:()=>{action='delete';return q;},insert:(v:any)=>{action='insert';payload=v;return q;},maybeSingle:async()=>({data:table==='teacher_calendar_settings'?settings:relation?{teacher_id:'teacher'}:null,error:null}),then:(ok:any,bad:any)=>Promise.resolve(execute()).then(ok,bad)};
    function execute(){if(table!=='scheduled_lessons')throw new Error('Unexpected table');
      if(action==='insert'){writes++;rows.push(...payload);return {data:payload,error:null};}
      if(action==='delete'){writes++;for(let i=rows.length-1;i>=0;i--)if(conditions.every(c=>c(rows[i])))rows.splice(i,1);return {error:null};}
      return {data:rows.filter(r=>conditions.every(c=>c(r))),error:null};}
    return q;
  }};
  const dependencies={DateTime,readWeeklyAvailability,availabilityIntervals,serve:(fn:any)=>{handler=fn;},corsHeaders:{},getAuthenticatedProfile:async()=>({adminClient:client,user:{id:role==='student'?'student':'teacher'},profile:{role}}),ensureFreshGoogleAccessToken:async()=>{tokenCalls++;return {accessToken:'synthetic'};},getGoogleCalendarFreeBusy:async()=>{if(googleError)throw new Error('Google unavailable');return {'synthetic-calendar':{busy,errors:calendarErrors?[{reason:'notFound'}]:[]}};}};
  (globalThis as any).__weeklyHarness=dependencies;Settings.now=()=>Date.parse(now);
  try {
    const code='const {'+Object.keys(dependencies).join(',')+'}=globalThis.__weeklyHarness;\n'+source.replace(/^import[\s\S]*?from .*?;\s*$/gm,'')+`\n// test ${count++}`;
    await import('data:application/typescript;base64,'+btoa(String.fromCharCode(...new TextEncoder().encode(code))));
    const response=await handler(new Request('https://synthetic.test',{method:'POST',body:JSON.stringify(body)}));
    return {status:response.status,result:await response.json(),rows,writes,tokenCalls};
  }finally{Settings.now=()=>Date.now();delete (globalThis as any).__weeklyHarness;}
}

Deno.test('real handler: weekdays only afternoon; split Saturday; no Sunday; Google and confirmed conflicts preserved',async()=>{
  const confirmed={id:'confirmed',teacher_id:'teacher',status:'scheduled',starts_at:'2026-11-09T17:00:00.000Z',ends_at:'2026-11-09T18:00:00.000Z'};
  const manual={...confirmed,id:'manual',status:'available',calendar_provider:'manual'};
  const old={...manual,id:'old-generated',calendar_provider:'google_calendar_availability'};
  const r=await run({lessons:[confirmed,manual,old],busy:[{start:'2026-11-10T14:00:00-03:00',end:'2026-11-10T15:00:00-03:00'}]});
  same(r.status,200);const generated=r.rows.filter(r=>!r.id);same(generated.length,12);
  for(const row of generated){const date=DateTime.fromISO(row.starts_at).setZone('America/Bahia');assert(date.weekday!==7);assert(date.weekday===6?date.hour>=7:date.hour>=14);assert(date.hour!==9&&date.hour!==10&&date.hour!==11&&date.hour!==12&&date.hour!==13);}
  same(r.rows.find(x=>x.id==='confirmed'),confirmed);same(r.rows.find(x=>x.id==='manual'),manual);assert(!r.rows.some(x=>x.id==='old-generated'));
});
Deno.test('legacy NULL retains full window; explicit empty schedule publishes no slots',async()=>{
  const legacy=await run({settings:{...template,availability_weekly_intervals:null,availability_weekdays:[6]}});same(legacy.status,200);same(legacy.result.availableSlots,13);
  const empty=await run({settings:{...template,availability_weekly_intervals:{}}});same(empty.status,200);same(empty.result.availableSlots,0);
});
Deno.test('invalid schedule/zone, unlinked student and Google failure never delete or insert slots',async()=>{
  for(const options of [{settings:{...template,availability_weekly_intervals:{1:[{start:'05:00',end:'09:00'}]}}},{settings:{...template,timezone:'Invalid/Zone'}},{role:'student',body:{teacherId:'teacher'},relation:false},{googleError:true},{calendarErrors:true},{busy:[{start:'invalid',end:'invalid'}]}]) {
    const r=await run(options);same(r.status,400);same(r.writes,0);
  }
});
Deno.test('overnight: prior weekday future portion survives; full duration never bridges a gap',async()=>{
  const r=await run({now:'2026-11-10T00:10:00-03:00',settings:{...template,availability_horizon_days:1,availability_start_time:'20:00',availability_end_time:'03:00',availability_weekly_intervals:{1:[{start:'23:00',end:'02:00'}]}}});
  same(r.status,200);same(r.result.availableSlots,1);same(r.rows[0].starts_at,'2026-11-10T04:00:00.000Z');
});
Deno.test('student can refresh only assigned teacher; admin can select teacher',async()=>{
  for(const role of ['student','admin']){const r=await run({role,body:{teacherId:'teacher'}});same(r.status,200);assert(r.rows.every(r=>r.teacher_id==='teacher'));}
});
Deno.test('real timezone transitions produce distinct complete slots, not nonexistent local hours',async()=>{
  const r=await run({now:'2026-11-01T00:00:00-04:00',settings:{...template,timezone:'America/New_York',availability_horizon_days:1,availability_start_time:'00:00',availability_end_time:'04:00',availability_weekly_intervals:{7:[{start:'01:00',end:'03:00'}]}}});
  same(r.status,200);same(r.result.availableSlots,3);same(new Set(r.rows.map(r=>r.starts_at)).size,3);
});
