import {useCallback,useEffect,useRef,useState} from 'react';
import {teacherLearningRpc} from '../../lib/teacherLearning';
import {safeHttpsUrl} from '../../lib/learningProgress';
import type {ProjectReviewRow,ProjectSubmissionRow} from '../../types/learning';

type ReviewedSubmission=ProjectSubmissionRow&{reviews:ProjectReviewRow[]};
export type ProjectReviewItem=ReviewedSubmission&{title:string;project_kind:'mini_project'|'project';assessment_criteria?:string[];requirements?:string[];previous_versions?:ReviewedSubmission[]};
const statusLabels={submitted:'Enviado',in_review:'Em avaliação',needs_revision:'Ajustes necessários',approved:'Aprovado'};
function ReviewHistory({reviews}:{reviews:ProjectReviewRow[]}) {
 return <ol className="mt-3 space-y-3">{reviews.map(r=><li key={r.id}><p>{new Date(r.created_at).toLocaleString('pt-BR')} · {statusLabels[r.status]} · {r.grade==null?'Sem nota':`Nota: ${r.grade}/100`}</p><p className="whitespace-pre-wrap break-words">{r.teacher_feedback}</p></li>)}</ol>;
}
function SubmissionLinks({item}:{item:ProjectSubmissionRow}) {
 const url=safeHttpsUrl(item.submission_url);
 return <>{url&&<a href={url} target="_blank" rel="noopener noreferrer" className="text-brand-ice underline">Abrir entrega ↗</a>}{item.project_description&&<p className="whitespace-pre-wrap break-words">{item.project_description}</p>}{item.additional_links?.map((link,index)=>{const href=safeHttpsUrl(link.url);return href?<p key={index}><a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-ice underline">{link.description} ↗</a></p>:null;})}{item.student_notes&&<p className="whitespace-pre-wrap break-words">{item.student_notes}</p>}</>;
}
export function ProjectReviewForm({item,onSaved}: {item:ProjectReviewItem;onSaved:()=>Promise<void>}) {
 const last=item.reviews.at(-1);
 const [grade,setGrade]=useState(last?.grade?.toString()??'');
 const [status,setStatus]=useState<ProjectReviewRow['status']>(last?.status??'in_review');
 const [feedback,setFeedback]=useState(last?.teacher_feedback??'');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const pending=useRef<{payload:string;id:string}|null>(null);
 const submit=async(event:React.FormEvent)=>{
  event.preventDefault();if(busy) return;
  const numeric=grade===''?null:Number(grade);
  const payload=JSON.stringify([item.id,status,numeric,feedback]);
  if(pending.current?.payload!==payload) pending.current={payload,id:crypto.randomUUID()};
  setBusy(true);setError('');
  try {
   await teacherLearningRpc('review_student_project',{p_submission_id:item.id,p_status:status,p_grade:numeric,p_feedback:feedback,p_request_id:pending.current.id});
   await onSaved();window.dispatchEvent(new Event('gamification-updated'));
  } catch(e) {setError(e instanceof Error?e.message:'Não foi possível registrar a avaliação.');}
  finally {setBusy(false);}
 };
 const field='mt-2 w-full rounded-xl bg-background p-3 text-white ring-1 ring-white/20';
 return <article className="space-y-4 rounded-2xl border border-white/15 p-4" aria-label={`Entrega: ${item.title}`}>
  <h3 className="font-bold">{item.title} · {item.project_kind==='mini_project'?'Miniprojeto':'Projeto'} · Versão {item.version}</h3>
  <p className="text-sm text-brand-ice">{statusLabels[last?.status??'submitted']}</p>
  <SubmissionLinks item={item}/>
  <section aria-label="Critérios de avaliação do projeto"><h4 className="font-semibold">Critérios de avaliação</h4>{item.assessment_criteria?.length?<ul className="list-inside list-disc">{item.assessment_criteria.map((criterion,index)=><li key={index}>{criterion}</li>)}</ul>:<p className="text-sm text-white/60">Nenhum critério cadastrado para este projeto.</p>}</section>
  {Boolean(item.requirements?.length)&&<details><summary className="cursor-pointer">Requisitos da entrega</summary><ul className="list-inside list-disc">{item.requirements?.map((requirement,index)=><li key={index}>{requirement}</li>)}</ul></details>}
  <form onSubmit={event=>void submit(event)} className="space-y-4">
   <label className="block">Situação da entrega<select aria-label="Situação da entrega" value={status} disabled={busy} onChange={e=>setStatus(e.target.value as ProjectReviewRow['status'])} className={field}><option value="in_review">Em avaliação</option><option value="needs_revision">Solicitar ajustes</option><option value="approved">Aprovar</option></select></label>
   <label className="block">Nota (0 a 100)<input aria-label="Nota (0 a 100)" type="number" min={0} max={100} step="0.01" required={status==='approved'} disabled={busy} value={grade} onChange={e=>setGrade(e.target.value)} className={field}/></label>
   <label className="block">Devolutiva para o aluno<textarea aria-label="Devolutiva para o aluno" rows={3} maxLength={20000} disabled={busy} value={feedback} onChange={e=>setFeedback(e.target.value)} className={field}/></label>
   <p className="text-sm text-white/60">A nota é convertida em XP por arredondamento no servidor. Alterar a nota ajusta o crédito existente, mantendo as avaliações anteriores no histórico. Sem nota, o crédito anterior é preservado.</p>
   {error&&<p role="alert" className="text-rose-200">{error}</p>}
   <button type="submit" className="btn-primary" disabled={busy}>{busy?'Salvando…':'Registrar avaliação do projeto'}</button>
  </form>
  {item.reviews.length>0&&<details><summary className="cursor-pointer font-semibold">Histórico desta versão</summary><ReviewHistory reviews={item.reviews}/></details>}
  {Boolean(item.previous_versions?.length)&&<details><summary className="cursor-pointer font-semibold">Versões anteriores</summary><div className="mt-3 space-y-5">{item.previous_versions?.map(previous=><section key={previous.id} aria-label={`Versão anterior ${previous.version}`} className="space-y-3 rounded-xl border border-white/10 p-3"><h4 className="font-bold">Versão {previous.version}</h4><SubmissionLinks item={previous}/><ReviewHistory reviews={previous.reviews}/></section>)}</div></details>}
 </article>;
}
export default function ProjectReviewPanel({scheduledLessonId,studentId}: {scheduledLessonId:string;studentId?:never}|{studentId:string;scheduledLessonId?:never}) {
 const [items,setItems]=useState<ProjectReviewItem[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [filter,setFilter]=useState('all');
 const load=useCallback(async()=>{
  try {setError('');setItems(studentId?await teacherLearningRpc<ProjectReviewItem[]>('teacher_student_projects',{p_student_id:studentId}):await teacherLearningRpc<ProjectReviewItem[]>('teacher_project_inbox',{p_scheduled_lesson_id:scheduledLessonId}));}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar as entregas.');}
  finally {setLoading(false);}
 },[scheduledLessonId,studentId]);
 useEffect(()=>{void load();},[load]);
 return <section aria-label="Avaliação de projetos" className="mt-8 space-y-5 rounded-3xl bg-surface p-5 text-white ring-1 ring-white/10">
  <h2 className="text-2xl font-bold">Projetos do aluno</h2>
  <label className="grid gap-2 text-sm">Filtrar entregas<select className="input" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todas as entregas</option><option value="pending">Pendentes de avaliação</option><option value="needs_revision">Ajustes necessários</option><option value="approved">Aprovadas</option></select></label>
  {loading&&<p role="status">Carregando entregas…</p>}
  {error&&<div role="alert"><p>{error}</p><button type="button" className="btn-secondary mt-3" onClick={()=>void load()}>Tentar novamente</button></div>}
  {notice&&<p role="status">{notice}</p>}
  {!loading&&!error&&!items.length&&<p>Nenhuma entrega de projeto encontrada para este aluno.</p>}
  {!loading&&!error&&items.length>0&&!items.some(item=>filter==='all'||(filter==='pending'?!item.reviews.at(-1)||item.reviews.at(-1)?.status==='in_review':item.reviews.at(-1)?.status===filter))&&<p>Nenhuma entrega neste filtro.</p>}
  {items.filter(item=>filter==='all'||(filter==='pending'?!item.reviews.at(-1)||item.reviews.at(-1)?.status==='in_review':item.reviews.at(-1)?.status===filter)).map(item=><ProjectReviewForm key={`${item.id}-${item.reviews.at(-1)?.id??'new'}`} item={item} onSaved={async()=>{await load();setNotice('Avaliação registrada. O saldo de XP foi atualizado pelo servidor.');}}/>)}
 </section>;
}
