import {useState} from 'react';
import {supabase} from '../../lib/supabaseClient';

export function CurriculumLessonPublication({lessonId,onPublished}:{lessonId:string;onPublished:()=>void}) {
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 async function publish() {
  if(saving||!window.confirm('Liberar esta aula para os alunos da nova grade? Confira as atividades e a prévia antes de continuar.'))return;
  setSaving(true);setError('');
  try {
   const {error:failure}=await supabase.rpc('publish_curriculum_lesson',{p_lesson_id:lessonId});
   if(failure)throw failure;
   onPublished();
  } catch(cause) {setError(cause&&typeof cause==='object'&&'message' in cause?String(cause.message):'Não foi possível liberar a aula.');}
  finally {setSaving(false);}
 }
 return <div className="mt-4 space-y-3 rounded-xl border border-amber-300/20 p-4">
  <p className="text-sm text-amber-100">Em preparação. Importe os materiais, confira a prévia e libere a aula quando estiver pronta.</p>
  <button type="button" className="btn-secondary" disabled={saving} onClick={()=>void publish()}>{saving?'Liberando…':'Liberar aula para alunos'}</button>
  {error&&<p role="alert" className="text-sm text-red-200">{error}</p>}
 </div>;
}
