import {useState} from 'react';
import {Link,useParams,useSearchParams} from 'react-router-dom';
import {activityStatusLabels} from '../../lib/learningProgress';
import {pedagogyCourseLabels,pedagogyDate} from '../../lib/pedagogy';
import type {PedagogyActivity,PedagogyAttempt,PedagogyJourney as JourneyData,PedagogyPage} from '../../types/pedagogy';
import {usePedagogyQuery} from './usePedagogyQuery';
import {PedagogyBadge,PedagogyPagination,PedagogyProgress,PedagogyState,pedagogyField} from './PedagogyShared';

const activityLabels={video:'Vídeo',slides:'Slides',mindmap:'Mapa mental',quiz:'Questionário',interactive:'Prática interativa',project:'Projeto',online_lesson:'Aula online',flashcards:'Cartões didáticos'};

function Attempts({studentId,activityId}:{studentId:string;activityId:string}) {
 const [page,setPage]=useState(1);
 const history=usePedagogyQuery<PedagogyPage<PedagogyAttempt>>('pedagogy_activity_attempts',{p_student_id:studentId,p_activity_id:activityId,p_page:page,p_page_size:10});
 return <div className="mt-4 space-y-4"><PedagogyState {...history} onRetry={history.retry}>{history.data&&<>
  {!history.data.items.length&&<p className="text-sm text-white/60">Nenhuma tentativa registrada.</p>}
  <ol className="space-y-3">{history.data.items.map(a=><li key={a.id} className="rounded-xl bg-background p-3 text-sm text-white/75"><p className="font-semibold text-white">Tentativa {a.attempt_number} · {a.score}% · {a.passed?'Aprovada':'Não aprovada'}</p><p className="mt-1 text-xs text-white/55">{pedagogyDate(a.submitted_at)} · Revisão {a.activity_revision}</p></li>)}</ol>
  <PedagogyPagination page={page} total={history.data.total} size={10} onPage={setPage} label="Tentativas"/>
 </>}</PedagogyState></div>;
}

function ActivityCard({activity:a,studentId,courseId}:{activity:PedagogyActivity;studentId:string;courseId:string}) {
 const [showAttempts,setShowAttempts]=useState(false);
 const label=a.interaction_type==='ordering'?'Ordenação':a.interaction_type==='matching'?'Associação':activityLabels[a.activity_type];
 return <li className="min-w-0 space-y-3 rounded-2xl border border-white/10 bg-background/50 p-4">
  <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-brand-lavender">{label} · {a.is_required?'Obrigatória':'Opcional'}</p><h4 className="mt-1 font-bold text-white">{a.title}</h4></div><PedagogyBadge complete={a.status==='completed'}>{activityStatusLabels[a.status]}</PedagogyBadge></div>
  <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/60"><p>Conclusão: {pedagogyDate(a.completed_at)}</p><p>{a.xp} XP recebidos</p>{!a.is_unlocked&&<p className="text-amber-200">Bloqueada por pré-requisitos ou etapa curricular</p>}</div>
  {a.activity_type==='flashcards'&&<p className="text-sm text-white/75">{a.flashcards_reviewed??0} de {a.flashcards_total??0} cartões revisados</p>}
  {(a.activity_type==='quiz'||a.activity_type==='interactive')&&<div className="space-y-3 text-sm text-white/70">
   <p>{a.question_count!==null?`${a.question_count} pergunta(s) · `:''}{a.attempts_total}/{a.max_attempts} tentativas</p>
   {a.latest_attempt&&<p>Último resultado: <strong className="text-white">{a.latest_attempt.score}% · {a.latest_attempt.passed?'Aprovado':'Não aprovado'}</strong> · {pedagogyDate(a.latest_attempt.submitted_at)}</p>}
   {a.max_attempts!==null&&a.attempts_total>=a.max_attempts&&a.status!=='completed'&&<p className="text-amber-200">Limite de tentativas atingido.</p>}
   <button type="button" className="btn-secondary" aria-expanded={showAttempts} aria-controls={`attempts-${a.id}`} onClick={()=>setShowAttempts(value=>!value)}>{showAttempts?'Recolher tentativas':'Ver histórico de tentativas'}</button>
   {showAttempts&&<div id={`attempts-${a.id}`}><Attempts studentId={studentId} activityId={a.id}/></div>}
  </div>}
  {a.activity_type==='project'&&<Link className="btn-secondary" to={`/acompanhamento-pedagogico?aba=projetos&situacao=all&estudante=${studentId}&curso=${courseId}`}>Ver entregas e avaliações</Link>}
 </li>;
}

function LessonActivities({studentId,lessonId,courseId}:{studentId:string;lessonId:string;courseId:string}) {
 const [page,setPage]=useState(1);
 const result=usePedagogyQuery<PedagogyPage<PedagogyActivity>>('pedagogy_lesson_detail',{p_student_id:studentId,p_lesson_id:lessonId,p_page:page,p_page_size:20});
 return <div className="mt-4 space-y-4" aria-label="Detalhamento das atividades"><PedagogyState {...result} onRetry={result.retry}>{result.data&&<>
  {!result.data.items.length&&<p className="rounded-xl border border-white/10 p-4 text-sm text-white/60">Esta aula usa o conteúdo legado, sem atividades publicadas. A conclusão considera o registro oficial da aula.</p>}
  <ul className="space-y-3">{result.data.items.map(a=><ActivityCard key={a.id} activity={a} studentId={studentId} courseId={courseId}/>)}</ul>
  <PedagogyPagination page={page} total={result.data.total} size={20} onPage={setPage} label="Atividades"/>
 </>}</PedagogyState></div>;
}

function CourseJourney({data,courseId,studentId}:{data:JourneyData;courseId:string;studentId:string}) {
 const [lessonId,setLessonId]=useState<string|null>(null);
 return <div className="space-y-4" aria-label="Árvore da jornada">{data.modules.map(m=><details key={m.id} className="rounded-2xl bg-surface ring-1 ring-white/10">
  <summary className="cursor-pointer rounded-2xl p-5 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-lavender"><span className="font-bold">{m.title}</span><span className="ml-3 text-xs text-white/60">{m.completed_lessons}/{m.total_lessons} aulas · {m.is_completed?'Módulo concluído':m.is_unlocked?'Em percurso':'Etapa bloqueada'}</span></summary>
  <div className="space-y-4 px-3 pb-5 md:px-5">{data.submodules.filter(sm=>sm.module_id===m.id).map(sm=><details key={sm.id} className="rounded-2xl border border-white/10 p-4">
   <summary className="cursor-pointer text-sm font-bold text-white">{sm.title}<span className="ml-2 text-xs font-normal text-white/55">{sm.completed_lessons}/{sm.total_lessons} aulas · {sm.total_lessons>0&&sm.completed_lessons===sm.total_lessons?'Submódulo concluído':'Pendente'}</span></summary>
   <ul className="mt-4 space-y-4">{data.lessons.filter(l=>l.submodule_id===sm.id).map(l=><li key={l.id} className="min-w-0 rounded-xl border border-white/10 p-3 md:p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0">{l.curriculum_number!=null&&<p className="mb-1 text-xs text-brand-lavender">{l.curriculum_number===0?'Introdução':`Aula ${String(l.curriculum_number).padStart(2,'0')}`}</p>}<h3 className="font-bold text-white">{l.title}</h3><p className="mt-2 text-xs leading-6 text-white/60">{l.publication_status==='planned'?'Materiais em preparação. Esta aula ainda não pode ser concluída.':`${l.required_completed}/${l.required_total} atividades obrigatórias concluídas · Última atividade: ${pedagogyDate(l.last_activity_at||l.completed_at)}`}</p></div><PedagogyBadge complete={l.status==='completed'}>{l.publication_status==='planned'?'Em preparação':l.status==='completed'?'Aula concluída':l.status==='in_progress'?'Em andamento':'Não iniciada'}</PedagogyBadge></div>
    {l.publication_status!=='planned'&&<button type="button" className="btn-secondary mt-4" aria-expanded={lessonId===l.id} aria-controls={`lesson-detail-${l.id}`} onClick={()=>setLessonId(current=>current===l.id?null:l.id)}>{lessonId===l.id?'Recolher atividades':'Ver atividades'}</button>}
    {lessonId===l.id&&<div id={`lesson-detail-${l.id}`}><LessonActivities key={l.id} studentId={studentId} lessonId={l.id} courseId={courseId}/></div>}
   </li>)}</ul>
  </details>)}</div>
 </details>)}</div>;
}

export function PedagogyJourney() {
 const {studentId=''}=useParams();
 const [params,setParams]=useSearchParams();
 const query=usePedagogyQuery<JourneyData>('pedagogy_student_journey',{p_student_id:studentId,p_course_id:params.get('curso')||null});
 const course=query.data?.courses.find(c=>c.course_id===query.data?.selected_course_id);
 return <div className="space-y-6"><Link to="/acompanhamento-pedagogico" className="inline-block text-sm font-semibold text-brand-lavender hover:underline">← Voltar ao acompanhamento</Link>
  <PedagogyState {...query} onRetry={query.retry}>{query.data&&<>
   <section className="space-y-5 rounded-3xl bg-surface p-5 ring-1 ring-white/10 md:p-7"><div><p className="text-xs font-bold uppercase tracking-widest text-brand-lavender">Jornada individual</p><h2 className="mt-2 text-2xl font-bold text-white">{query.data.student.name}</h2><details className="mt-2 text-xs text-white/50"><summary className="cursor-pointer">Identificação do aluno</summary><p className="mt-2 break-all">{query.data.student.id}</p></details></div>
    {!query.data.courses.length?<p className="text-white/65">Este aluno não possui cursos disponíveis no currículo atual.</p>:<>
     <label className="grid max-w-xl gap-2 text-sm text-white/70">Curso do aluno<select className={pedagogyField} value={query.data.selected_course_id||''} onChange={e=>setParams({curso:e.target.value})}>{query.data.courses.map(c=><option key={c.course_id} value={c.course_id}>{c.course_title} · {c.percent}% · {pedagogyCourseLabels[c.status]}</option>)}</select></label>
     {course&&<><PedagogyProgress value={course.percent} label="Progresso geral do curso"/><div className="flex flex-wrap gap-4 text-sm text-white/65"><p>{course.completed_lessons}/{course.total_lessons} aulas concluídas</p><p>{course.xp} XP no curso</p><p>Última atividade: {pedagogyDate(course.last_activity_at)}</p></div><Link className="btn-secondary" to={`/acompanhamento-pedagogico?aba=projetos&situacao=all&estudante=${studentId}&curso=${course.course_id}`}>Ver projetos deste curso</Link></>}
    </>}
   </section>
   {course&&<CourseJourney key={`${studentId}-${course.course_id}`} data={query.data} courseId={course.course_id} studentId={studentId}/>}
  </>}</PedagogyState>
 </div>;
}
