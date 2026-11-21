import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {TeacherScheduling} from '../../src/pages/TeacherScheduling';
import '../../src/index.css';

const initial={teacher_id:'synthetic-teacher',connection_status:'disconnected',availability_start_time:'07:00',availability_end_time:'20:00',availability_weekdays:[1,2,3,4,5],availability_slot_minutes:60,availability_horizon_days:30,timezone:'America/Bahia'};
const state={settings:JSON.parse(localStorage.getItem('synthetic-weekly-settings')||'null')||initial,writes:[] as unknown[]};
Object.assign(window,{weeklyState:state,syntheticClient:{auth:{getUser:async()=>({data:{user:{id:'synthetic-teacher'}}})},from(table:string){
  let payload:unknown;const query={select:()=>query,eq:()=>query,order:()=>query,upsert:(v:unknown)=>{payload=v;return query;},maybeSingle:async()=>({data:state.settings,error:null}),then:(ok:(v:unknown)=>unknown)=>{
    if(payload){state.settings={...state.settings,...payload as object};state.writes.push(payload);localStorage.setItem('synthetic-weekly-settings',JSON.stringify(state.settings));}
    return Promise.resolve({data:table==='teacher_calendar_settings'?state.settings:[],error:null}).then(ok);
  }};return query;
}}});
createRoot(document.getElementById('root')!).render(<BrowserRouter><TeacherScheduling /></BrowserRouter>);
