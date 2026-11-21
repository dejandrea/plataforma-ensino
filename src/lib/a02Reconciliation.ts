import {supabase} from './supabaseClient';
import type {LessonImport} from '../types/learning';

export const A02_LESSON_ID='b17a2000-0000-4000-8000-000000001002';
export type ReconciliationValues={title:string;description:string|null;order_index:number;duration_minutes:number|null;is_required:boolean;content_json:unknown;gamification_json:unknown;publication_status?:string};
export type A02ReconciliationPlan={
  token:string;lessonId:string;actualContext:Record<string,string>;documentContext:Record<string,string>;
  lessonBefore:{description:string|null;duration_minutes:number|null};lessonAfter:{description:string;durationMinutes:number};
  objectivesBefore:string[]|null;objectivesAfter:string[];
  activities:{key:string;id:string|null;action:'insert'|'update'|'keep';changedFields:string[];before:ReconciliationValues|null;after:ReconciliationValues}[];
};
function errorMessage(error:{code?:string;message:string}){
  return ['PGRST202','42883'].includes(error.code??'')?'A atualização segura ainda não foi instalada neste ambiente.':error.message;
}
export async function planA02Reconciliation(document:LessonImport):Promise<A02ReconciliationPlan>{
  const {data,error}=await supabase.rpc('plan_a02_reconciliation',{p_document:document});
  if(error)throw new Error(errorMessage(error));return data as A02ReconciliationPlan;
}
export async function applyA02Reconciliation(document:LessonImport,token:string){
  const {data,error}=await supabase.rpc('apply_a02_reconciliation',{p_document:document,p_expected_token:token,p_confirmed:true});
  if(error)throw new Error(errorMessage(error));return data as {newActivityIds:string[];published:false;activityCount:number};
}
