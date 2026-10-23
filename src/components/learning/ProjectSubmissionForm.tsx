import {useRef,useState} from 'react';
import {teacherLearningRpc} from '../../lib/teacherLearning';

export default function ProjectSubmissionForm({activityId,disabled,onSaved,onBusyChange}: {
 activityId:string;disabled:boolean;onSaved:()=>Promise<void>;onBusyChange:(busy:boolean)=>void;
}) {
 const [url,setUrl]=useState('');
 const [notes,setNotes]=useState('');
 const [description,setDescription]=useState('');
 const [links,setLinks]=useState([{url:'',description:''},{url:'',description:''}]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const pending=useRef<{payload:string;id:string}|null>(null);
 const submit=async(event:React.FormEvent)=>{
  event.preventDefault();if(busy||disabled) return;
  const extra=links.filter(link=>link.url.trim()||link.description.trim()).map(link=>({url:link.url.trim(),description:link.description.trim()}));
  const payload=JSON.stringify([url.trim(),notes,description,extra]);
  if(pending.current?.payload!==payload) pending.current={payload,id:crypto.randomUUID()};
  setBusy(true);onBusyChange(true);setError('');
  try {
   await teacherLearningRpc('submit_student_project',{p_activity_id:activityId,p_submission_url:url.trim(),p_student_notes:notes,p_request_id:pending.current.id,p_project_description:description.trim(),p_additional_links:extra});
   await onSaved();window.dispatchEvent(new Event('gamification-updated'));
  } catch(e) {setError(e instanceof Error?e.message:'Não foi possível enviar. Tente novamente.');}
  finally {setBusy(false);onBusyChange(false);}
 };
 return <form onSubmit={event=>void submit(event)} className="space-y-4 rounded-2xl border border-white/15 p-4" aria-label="Enviar projeto">
  <h3 className="font-bold text-white">Enviar para avaliação</h3>
  <label className="block">Link HTTPS do projeto<input aria-label="Link HTTPS do projeto" type="url" required pattern="https://.*" maxLength={2048} disabled={busy||disabled} value={url} onChange={e=>setUrl(e.target.value)} className="mt-2 w-full rounded-xl bg-background p-3 text-white ring-1 ring-white/20" /></label>
  <label className="block">Reflexão sobre a entrega<textarea aria-label="Reflexão sobre a entrega" rows={3} maxLength={20000} disabled={busy||disabled} value={notes} onChange={e=>setNotes(e.target.value)} className="mt-2 w-full rounded-xl bg-background p-3 text-white ring-1 ring-white/20" /></label>
  <label className="block">Descrição breve do projeto<textarea aria-label="Descrição breve do projeto" required maxLength={2000} rows={3} value={description} disabled={busy||disabled} onChange={e=>setDescription(e.target.value)} className="input mt-2 w-full"/></label>
  {links.map((link,index)=><fieldset key={index} disabled={busy||disabled} className="space-y-3 rounded-xl border border-white/15 p-3"><legend>Link adicional {index+1} (opcional)</legend><label className="block">URL<input aria-label={`URL adicional ${index+1}`} type="url" pattern="https://.*" maxLength={2048} required={Boolean(link.description.trim())} className="input mt-2 w-full" value={link.url} onChange={e=>setLinks(rows=>rows.map((row,i)=>i===index?{...row,url:e.target.value}:row))}/></label><label className="block">Descrição<input aria-label={`Descrição adicional ${index+1}`} maxLength={2000} required={Boolean(link.url.trim())} className="input mt-2 w-full" value={link.description} onChange={e=>setLinks(rows=>rows.map((row,i)=>i===index?{...row,description:e.target.value}:row))}/></label></fieldset>)}
  <p className="text-sm text-white/60">O envio recebe XP uma única vez. A nota da professora gera um crédito separado; reenvios não duplicam os pontos.</p>
  {error&&<p role="alert" className="text-rose-200">{error}</p>}
  <button type="submit" disabled={busy||disabled} className="btn-primary">{busy?'Enviando…':'Enviar projeto'}</button>
 </form>;
}
