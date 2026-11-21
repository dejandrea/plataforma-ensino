import {supabase} from './supabaseClient';

export type WorkspaceLesson={id:string;title:string;description:string|null;duration_minutes:number|null;publication_status:string;curriculum_number:number|null;order_index:number;submodule_id:string|null;module_id:string|null;video_url:string|null;pdf_url:string|null;slides_url:string|null;meet_link:string|null};
export type LessonWorkspace={lesson:WorkspaceLesson;course:{id:string;title:string}|null;module:{id:string;title:string}|null;submodule:{id:string;title:string}|null};
export async function loadLessonWorkspace(id:string):Promise<LessonWorkspace>{
 const {data:lesson,error}=await supabase.from('lessons').select('id,title,description,duration_minutes,publication_status,curriculum_number,order_index,submodule_id,module_id,video_url,pdf_url,slides_url,meet_link').eq('id',id).maybeSingle();
 if(error)throw new Error('Não foi possível carregar a aula. Tente novamente.');
 if(!lesson)throw new Error('Aula não encontrada ou sem permissão de acesso.');
 const row=lesson as WorkspaceLesson;
 let submodule:null|{id:string;title:string;module_id:string}=null;
 if(row.submodule_id){const result=await supabase.from('submodules').select('id,title,module_id').eq('id',row.submodule_id).maybeSingle();if(result.error)throw new Error('Não foi possível carregar o submódulo.');submodule=result.data;}
 let module:null|{id:string;title:string;course_id:string}=null;
 const moduleId=submodule?.module_id??row.module_id;
 if(moduleId){const result=await supabase.from('modules').select('id,title,course_id').eq('id',moduleId).maybeSingle();if(result.error)throw new Error('Não foi possível carregar o módulo.');module=result.data;}
 let course:null|{id:string;title:string}=null;
 if(module?.course_id){const result=await supabase.from('courses').select('id,title').eq('id',module.course_id).maybeSingle();if(result.error)throw new Error('Não foi possível carregar o curso.');course=result.data;}
 return {lesson:row,submodule,module,course};
}
export function curriculumReturnUrl(workspace:LessonWorkspace){
 const params=new URLSearchParams();
 if(workspace.course)params.set('curso',workspace.course.id);
 if(workspace.module)params.set('modulo',workspace.module.id);
 if(workspace.submodule)params.set('submodulo',workspace.submodule.id);
 params.set('aula',workspace.lesson.id);
 return '/gestao/conteudo?'+params;
}
