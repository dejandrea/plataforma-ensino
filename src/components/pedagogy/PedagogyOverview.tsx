import {Link,useSearchParams} from 'react-router-dom';
import {pedagogyCourseLabels,pedagogyDate,pedagogyPeriod} from '../../lib/pedagogy';
import type {CourseStatus,PedagogyDashboard} from '../../types/pedagogy';
import {usePedagogyQuery} from './usePedagogyQuery';
import {PedagogyBadge,PedagogyPagination,PedagogyProgress,PedagogyState,pedagogyField} from './PedagogyShared';
import {PedagogyProjects} from './PedagogyProjects';

export function PedagogyOverview() {
 const [params,setParams]=useSearchParams();
 const projects=params.get('aba')==='projetos';
 const page=Number(params.get('pagina')||1);
 const base={p_search:params.get('aluno')||'',p_course_id:params.get('curso')||null,p_teacher_id:params.get('professora')||null};
 const dashboard=usePedagogyQuery<PedagogyDashboard>('pedagogy_dashboard',{...base,p_status:params.get('status')||'all',p_page:projects?1:page,p_page_size:10,...pedagogyPeriod(params.get('de')||'',params.get('ate')||'')});
 const change=(key:string,value:string)=>setParams(current=>{const next=new URLSearchParams(current);if(value)next.set(key,value);else next.delete(key);next.delete('pagina');return next;});
 const onPage=(value:number)=>setParams(current=>{const next=new URLSearchParams(current);next.set('pagina',String(value));return next;});
 const projectArgs={...base,p_status:params.get('situacao')||'pending',p_student_id:params.get('estudante')||null,p_page:page,p_page_size:10};
 return <div className="space-y-7">
  <div role="tablist" aria-label="Seções do acompanhamento" className="flex flex-wrap gap-2"><button type="button" role="tab" aria-selected={!projects} className={!projects?'btn-primary':'btn-secondary'} onClick={()=>change('aba','')}>Visão geral</button><button type="button" role="tab" aria-selected={projects} className={projects?'btn-primary':'btn-secondary'} onClick={()=>change('aba','projetos')}>Projetos para avaliar</button></div>
  <section aria-label="Filtros do acompanhamento" className="rounded-3xl bg-surface p-5 ring-1 ring-white/10">
   <form key={`${params.toString()}-${dashboard.data?.courses.length??0}`} onSubmit={event=>{
    event.preventDefault();const form=new FormData(event.currentTarget);
    const next=new URLSearchParams(params);for(const name of ['aluno','curso','professora','status','situacao','de','ate']){if(!form.has(name))continue;const value=String(form.get(name)||'').trim();if(value)next.set(name,value);else next.delete(name);}
    next.delete('pagina');next.delete('estudante');setParams(next);
   }}><fieldset disabled={dashboard.loading} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 disabled:opacity-60">
    <label className="grid gap-2 text-sm text-white/75">Aluno<input name="aluno" type="search" maxLength={200} placeholder="Nome, apelido ou identificação" defaultValue={base.p_search} className={pedagogyField}/></label>
    <label className="grid gap-2 text-sm text-white/75">Curso<select name="curso" defaultValue={base.p_course_id||''} className={pedagogyField}><option value="">Todos os cursos</option>{dashboard.data?.courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
    <label className="grid gap-2 text-sm text-white/75">Professora<select name="professora" defaultValue={base.p_teacher_id||''} className={pedagogyField}><option value="">Todas no meu escopo</option>{dashboard.data?.teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    {projects?<label className="grid gap-2 text-sm text-white/75">Situação da avaliação<select name="situacao" defaultValue={params.get('situacao')||'pending'} className={pedagogyField}><option value="pending">Aguardando avaliação</option><option value="reviewed">Avaliados</option><option value="needs_revision">Devolvidos para revisão</option><option value="approved">Aprovados</option><option value="all">Todos</option></select></label>:<label className="grid gap-2 text-sm text-white/75">Status do curso<select name="status" defaultValue={params.get('status')||'all'} className={pedagogyField}><option value="all">Todos</option>{Object.entries(pedagogyCourseLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>}
    {!projects&&<><label className="grid gap-2 text-sm text-white/75">Conclusões de atividades: de<input name="de" type="date" defaultValue={params.get('de')||''} className={pedagogyField}/></label><label className="grid gap-2 text-sm text-white/75">Até<input name="ate" type="date" defaultValue={params.get('ate')||''} className={pedagogyField}/></label></>}
    <div className="flex flex-wrap items-end gap-3 sm:col-span-2"><button type="submit" className="btn-primary">Aplicar filtros</button><button type="button" className="btn-secondary" onClick={()=>setParams(projects?{aba:'projetos'}:{})}>Limpar filtros</button></div>
   </fieldset></form>
  </section>
  <PedagogyState {...dashboard} onRetry={dashboard.retry}>
   {dashboard.data&&!projects&&<>
    <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
     ['Alunos ativos',dashboard.data.summary.active_students],['Alunos com cursos em andamento',dashboard.data.summary.students_in_progress],['Cursos concluídos',dashboard.data.summary.completed_courses],['Projetos aguardando avaliação',dashboard.data.summary.pending_projects],['Atividades concluídas no período',dashboard.data.summary.completed_activities],
    ].map(([label,value])=><div key={label} className="rounded-2xl border border-white/10 bg-surface p-5"><dt className="text-xs leading-5 text-white/60">{label}</dt><dd className="mt-3 text-3xl font-extrabold text-white">{value}</dd></div>)}</dl>
    <section aria-label="Jornadas dos alunos" className="space-y-4 rounded-3xl bg-surface p-4 ring-1 ring-white/10 md:p-6">
     <h2 className="text-xl font-bold text-white">Jornadas dos alunos</h2><p className="text-sm text-white/55">Uma jornada por aluno e curso. O progresso considera as conclusões registradas.{!params.get('de')&&!params.get('ate')?' O período mostra os últimos 30 dias.':''}</p>
     {!dashboard.data.items.length&&<p className="py-8 text-white/65">Nenhum aluno encontrado para estes filtros.</p>}
     <ul className="divide-y divide-white/10">{dashboard.data.items.map(row=><li key={`${row.student_id}-${row.course_id??'none'}`} className="grid min-w-0 gap-4 py-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0"><h3 className="font-bold text-white">{row.student_name}</h3><p className="mt-1 text-sm text-white/65">{row.course_title||'Sem curso disponível'}</p><details className="mt-2 text-xs text-white/45"><summary className="cursor-pointer">Identificação do aluno</summary><p className="mt-2 break-all">{row.student_id}</p>{row.nickname&&<p className="mt-1">Apelido: {row.nickname}</p>}</details></div>
      <div className="space-y-3"><PedagogyBadge complete={row.status==='completed'}>{pedagogyCourseLabels[row.status as CourseStatus]}</PedagogyBadge>{row.percent!==null&&<PedagogyProgress value={row.percent} label="Progresso do curso"/>}</div>
      <div className="space-y-2 text-xs text-white/60"><p>Última atividade: {pedagogyDate(row.last_activity_at)}</p><p>{row.pending_projects} projeto(s) pendente(s) · {row.xp??0} XP no curso</p></div>
      <Link className="btn-secondary justify-self-start" to={`alunos/${row.student_id}${row.course_id?`?curso=${row.course_id}`:''}`}>Ver jornada</Link>
     </li>)}</ul>
     <PedagogyPagination page={dashboard.data.page} total={dashboard.data.total} size={dashboard.data.page_size} onPage={onPage} label="Jornadas"/>
    </section>
   </>}
  </PedagogyState>
  {projects&&<PedagogyProjects key={JSON.stringify(projectArgs)} args={projectArgs} onPage={onPage} onChanged={dashboard.retry}/>}
 </div>;
}
