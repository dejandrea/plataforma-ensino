import {supabase} from './supabaseClient';
import type {ActivityDefinition,LessonImport} from '../types/learning';
export type EditorialDraft={version:number;document:LessonImport;source_token:string;status:'draft'|'published'};
export type EditorialState={document:unknown;lessonTitle:string;sourceToken:string;hasHistory:boolean;draft:EditorialDraft|null;
 events:{id:number;operation:string;draft_version:number;created_at:string}[]};
export type EditorialPlan={lessonId:string;sourceToken:string;draftVersion:number;needsIdentity:boolean;canSave:boolean;issues:string[];
 document:LessonImport;lessonBefore:unknown;lessonAfter:unknown;lessonClasses:string[];teacherChanges:unknown[];
 activities:{key:string;id:string|null;classes:string[];changedFields:string[];before:ActivityDefinition|null;after:ActivityDefinition;omitted:boolean;publicationBefore:string|null;publicationAfter:string}[]};
async function rpc<T>(name:string,params:Record<string,unknown>):Promise<T>{
 const {data,error}=await supabase.rpc(name,params);
 if(error)throw new Error(['PGRST202','42883'].includes(error.code)?'A fundação editorial ainda não está instalada neste ambiente.':error.message);
 return data as T;
}
export const loadEditorialLesson=(lessonId:string)=>rpc<EditorialState>('admin_editorial_lesson',{p_lesson_id:lessonId});
export const compareEditorialLesson=(lessonId:string,document:LessonImport)=>rpc<EditorialPlan>('plan_editorial_lesson',{p_lesson_id:lessonId,p_document:document});
export const saveEditorialDraft=(lessonId:string,document:LessonImport,plan:EditorialPlan,confirmed:boolean)=>rpc<EditorialDraft>('save_editorial_draft',{
 p_lesson_id:lessonId,p_document:document,p_expected_source:plan.sourceToken,p_expected_version:plan.draftVersion,p_confirm_identity:confirmed});
export const publishEditorialDraft=(lessonId:string,draft:EditorialDraft)=>rpc<{published:true}>('publish_editorial_draft',{
 p_lesson_id:lessonId,p_expected_source:draft.source_token,p_expected_version:draft.version,p_confirmed:true});
/** JSONB returns object properties in a different order; array order remains meaningful. */
export function sameEditorialDocument(a:unknown,b:unknown):boolean{
 const canonical=(value:unknown)=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([x],[y])=>x.localeCompare(y))):item);
 return canonical(a)===canonical(b);
}
