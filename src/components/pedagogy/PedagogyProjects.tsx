import {useState} from 'react';
import {Link} from 'react-router-dom';
import {ProjectReviewForm,type ProjectReviewItem} from '../learning/ProjectReviewPanel';
import {pedagogyDate,pedagogyProjectLabels} from '../../lib/pedagogy';
import type {PedagogyPage,PedagogyProject} from '../../types/pedagogy';
import {usePedagogyQuery} from './usePedagogyQuery';
import {PedagogyBadge,PedagogyPagination,PedagogyState} from './PedagogyShared';

function ProjectEvaluation({item,onSaved,onClose}:{item:PedagogyProject;onSaved:()=>void;onClose:()=>void}) {
 const detail=usePedagogyQuery<ProjectReviewItem>('pedagogy_project_detail',{p_submission_id:item.submission_id});
 return <section aria-label={`Avaliar projeto de ${item.student_name}`} className="space-y-4 rounded-3xl border border-brand-purple/40 bg-surface p-4 text-sm text-white/80 md:p-6">
  <header className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-white">Avaliação de {item.student_name}</h2><p className="mt-2 text-white/60">{item.course_title} · {item.module_title} · {item.lesson_title}</p><p className="mt-1 text-white/60">Enviado em {pedagogyDate(item.submitted_at)}</p></div><button type="button" className="btn-secondary" onClick={onClose}>Fechar avaliação</button></header>
  <PedagogyState {...detail} onRetry={detail.retry}>{detail.data&&<ProjectReviewForm key={`${detail.data.id}-${detail.data.reviews.at(-1)?.id??'new'}`} item={detail.data} onSaved={async()=>{detail.retry();onSaved();}}/>}</PedagogyState>
 </section>;
}

export function PedagogyProjects({args,onPage,onChanged}:{args:Record<string,unknown>;onPage:(page:number)=>void;onChanged:()=>void}) {
 const list=usePedagogyQuery<PedagogyPage<PedagogyProject>>('pedagogy_projects',args);
 const [selected,setSelected]=useState<string|null>(null);
 const [notice,setNotice]=useState('');
 const selectedItem=list.data?.items.find(p=>p.submission_id===selected);
 return <section className="space-y-5" aria-label="Projetos para avaliar">
  <div><h2 className="text-2xl font-bold text-white">Projetos para avaliar</h2><p className="mt-2 text-sm text-white/60">Consulte as entregas e registre a avaliação com os critérios de cada projeto.</p></div>
  {notice&&<p role="status" className="rounded-xl bg-emerald-300/10 p-4 text-sm text-emerald-100">{notice}</p>}
  <PedagogyState {...list} onRetry={list.retry}>
   {list.data&&<>
    {!list.data.items.length&&<p className="rounded-2xl bg-surface p-6 text-white/65">Nenhum projeto encontrado para estes filtros.</p>}
    <ul className="grid gap-4 lg:grid-cols-2">{list.data.items.map(item=><li key={item.submission_id} className="min-w-0 space-y-4 rounded-2xl bg-surface p-5 ring-1 ring-white/10">
     <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-semibold text-brand-lavender">{item.project_kind==='project'?'Projeto':'Miniprojeto'}</p><h3 className="mt-1 text-lg font-bold text-white">{item.title}</h3></div><PedagogyBadge complete={item.status==='approved'}>{pedagogyProjectLabels[item.status]}</PedagogyBadge></div>
     <p className="text-sm font-semibold text-white/90">{item.student_name}</p><p className="text-xs leading-6 text-white/60">{item.course_title} / {item.module_title} / {item.lesson_title}</p>
     <p className="text-xs text-white/60">Envio: {pedagogyDate(item.submitted_at)}{item.grade!==null?` · Nota: ${item.grade}/100`:''}</p>
     <div className="flex flex-wrap gap-3"><button type="button" className="btn-primary" onClick={()=>setSelected(item.submission_id)}>{item.status==='approved'||item.status==='needs_revision'?'Ver avaliação':'Abrir entrega'}</button><Link className="btn-secondary" to={`alunos/${item.student_id}?curso=${item.course_id}`}>Ver jornada</Link></div>
    </li>)}</ul>
    <PedagogyPagination page={list.data.page} total={list.data.total} size={list.data.page_size} onPage={onPage} label="Projetos"/>
   </>}
  </PedagogyState>
  {selectedItem&&<ProjectEvaluation key={selectedItem.submission_id} item={selectedItem} onClose={()=>setSelected(null)} onSaved={()=>{setNotice('Avaliação registrada. A nota e o histórico foram atualizados.');list.retry();onChanged();}}/>}
 </section>;
}
