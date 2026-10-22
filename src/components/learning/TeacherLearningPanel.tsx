import { useCallback, useEffect, useRef, useState } from 'react';
import { teacherLearningRpc, type TeacherSession, type TeacherWorkspace } from '../../lib/teacherLearning';
import type { PlanSessionRow } from '../../types/learning';

const surface = 'rounded-3xl bg-surface p-5 ring-1 ring-white/10';
const field = 'mt-2 w-full rounded-xl border border-white/20 bg-surface p-3 text-white';
const button = 'rounded-xl bg-brand-magenta px-4 py-3 font-bold text-white disabled:opacity-40';
const levels = [['needs_support','Precisa de apoio'],['developing','Em desenvolvimento'],['autonomous','Realiza com autonomia']];
type Draft = Pick<PlanSessionRow,'completed_step_keys'|'notes'|'evaluation_json'>;

function SessionPlan({session,meetingStatus}: {session: TeacherSession; meetingStatus: string}) {
  const initial: Draft = {completed_step_keys:session.completed_step_keys,notes:session.notes,evaluation_json:session.evaluation_json};
  const [draft,setDraft] = useState(initial);
  const [evaluationText,setEvaluationText] = useState({difficulties:(initial.evaluation_json.difficulties??[]).join('\n'),recommendations:(initial.evaluation_json.recommendations??[]).join('\n')});
  const latest = useRef(initial);
  const version = useRef(session.version);
  const generation = useRef(0);
  const saved = useRef(0);
  const busy = useRef(false);
  const mounted = useRef(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  const [savedGeneration,setSavedGeneration] = useState(0);
  const [confirmed,setConfirmed] = useState(session.confirmed_at);
  const [confirming,setConfirming] = useState(false);
  const cancelled = meetingStatus === 'cancelled';
  const change = (next: Draft) => {latest.current=next;generation.current++;setDraft(next);};
  const flush = useCallback(async () => {
    if(busy.current) return false;
    busy.current=true;setSaving(true);setError('');
    try {
      while(saved.current<generation.current && mounted.current) {
        const target=generation.current;
        const value=latest.current;
        const row=await teacherLearningRpc<PlanSessionRow & {version:number}>('save_teacher_learning_session',{
          p_session_id:session.id,p_version:version.current,p_completed_step_keys:value.completed_step_keys,
          p_notes:value.notes,p_evaluation:value.evaluation_json,
        });
        version.current=row.version;saved.current=target;
        if(mounted.current) setSavedGeneration(target);
      }
      return true;
    } catch(e) {if(mounted.current) setError(e instanceof Error?e.message:'Não foi possível salvar.');return false;}
    finally {busy.current=false;if(mounted.current) setSaving(false);}
  },[session.id]);
  useEffect(()=>{
    mounted.current=true;
    const warn=(event: BeforeUnloadEvent)=>{if(saved.current<generation.current){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',warn);
    return ()=>{mounted.current=false;window.removeEventListener('beforeunload',warn);};
  },[]);
  useEffect(()=>{
    if(generation.current===0 || cancelled) return;
    const timer=window.setTimeout(()=>void flush(),500);
    return ()=>window.clearTimeout(timer);
  },[draft,flush,cancelled]);
  const updateEvaluation=(key: string,value: unknown)=>{
    const evaluation={...latest.current.evaluation_json};
    if(value==='') delete evaluation[key as keyof typeof evaluation];
    else Object.assign(evaluation,{[key]:value});
    change({...latest.current,evaluation_json:evaluation});
  };
  const confirm=async()=>{
    setConfirming(true);
    try {
      if(!await flush()) return;
      const row=await teacherLearningRpc<{version:number;confirmed_at:string}>('confirm_teacher_learning_activity',{p_session_id:session.id,p_version:version.current});
      version.current=row.version;setConfirmed(row.confirmed_at);
    } catch(e) {setError(e instanceof Error?e.message:'Não foi possível confirmar.');}
    finally {setConfirming(false);}
  };
  const count=draft.completed_step_keys.length,total=session.plan.steps.length;
  const percent=Math.round(count/total*100);
  return <article className={`${surface} space-y-5`} aria-label={`Plano: ${session.activity_title}`}>
    <header>
      <p className="break-words text-sm text-brand-lavender">{session.course_title} / {session.module_title} / {session.submodule_title} / {session.lesson_title}</p>
      <h3 className="mt-2 text-xl font-bold">{session.activity_title}</h3>
      <p className="text-sm text-white/60">Plano revisão {session.plan_revision} · {session.plan.durationMinutes} min previstos · Registro restrito à equipe docente</p>
    </header>
    <div><p>{count} de {total} etapas realizadas · {percent}% de execução</p>
      <progress aria-label="Execução do plano" className="w-full accent-purple-500" max={total} value={count} />
      <p className="text-sm text-white/60">Este indicador acompanha o roteiro executado; a avaliação do aluno fica registrada abaixo.</p>
      <p className="mt-2 text-sm">Pendentes: {session.plan.steps.filter(s=>!draft.completed_step_keys.includes(s.key)).map(s=>s.title).join(', ') || 'Nenhuma'}</p>
    </div>
    <details><summary className="cursor-pointer font-bold">Preparação e objetivos</summary>
      {([['Objetivos',session.plan.objectives],['Pré-requisitos',session.plan.prerequisites],['Preparação',session.plan.preparation],['Critérios de avaliação',session.plan.assessmentCriteria]] as const).map(([label,items])=><div key={label} className="mt-3"><h4 className="font-bold">{label}</h4><ul className="list-inside list-disc">{items.map((v,i)=><li key={i}>{v}</li>)}</ul></div>)}
    </details>
    <fieldset disabled={cancelled || confirming} className="min-w-0 space-y-4">
      <legend className="font-bold">Roteiro do encontro</legend>
      {session.plan.steps.map(step=><div key={step.key} className="rounded-xl border border-white/15 p-4">
        <label className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={draft.completed_step_keys.includes(step.key)} onChange={e=>change({...latest.current,completed_step_keys:e.target.checked?[...latest.current.completed_step_keys,step.key]:latest.current.completed_step_keys.filter(k=>k!==step.key)})} /><span>Realizada: {step.title}</span></label>
        <details className="mt-3"><summary className="cursor-pointer">Abrir etapa: {step.title} · {step.durationMinutes} min</summary>
          <div className="mt-3 space-y-3 whitespace-pre-wrap break-words">
            <p><strong>Objetivo: </strong>{step.objective}</p><p><strong>Orientações: </strong>{step.guidance}</p>
            {step.code && <div><p>Arquivo: {step.code.file} · {step.code.language}</p><pre className="max-w-full overflow-x-auto rounded-xl bg-black/30 p-3"><code>{step.code.source}</code></pre><p>Resultado esperado: {step.code.expectedResult}</p></div>}
            {step.questions.map((q,i)=><div key={i}><p><strong>Pergunta: </strong>{q.prompt}</p><p><strong>Resposta esperada: </strong>{q.expectedAnswer}</p></div>)}
            <p><strong>Explicação detalhada: </strong>{step.detailedExplanation}</p><p><strong>Explicação lúdica: </strong>{step.playfulExplanation}</p>
            <div><strong>Dificuldades comuns</strong><ul className="list-inside list-disc">{step.commonDifficulties.map((v,i)=><li key={i}>{v}</li>)}</ul></div><p><strong>Desafio: </strong>{step.challenge}</p>
          </div>
        </details>
      </div>)}
      <h4 className="font-bold">Avaliação pedagógica do encontro</h4>
      {(['comprehension','practice','autonomy'] as const).map((key,i)=><label key={key} className="block">{['Compreensão dos conceitos','Aplicação prática','Autonomia'][i]}<select aria-label={['Compreensão dos conceitos','Aplicação prática','Autonomia'][i]} className={field} value={draft.evaluation_json[key]??''} onChange={e=>updateEvaluation(key,e.target.value)}><option value="">Ainda não avaliado</option>{levels.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>)}
      <label className="block">Observações da professora<textarea aria-label="Observações da professora" className={field} maxLength={20000} rows={4} value={draft.notes} onChange={e=>change({...latest.current,notes:e.target.value})} /></label>
      {(['difficulties','recommendations'] as const).map((key,i)=><label key={key} className="block">{['Dificuldades identificadas','Recomendações para o próximo encontro'][i]} (uma por linha)<textarea aria-label={`${['Dificuldades identificadas','Recomendações para o próximo encontro'][i]} (uma por linha)`} className={field} rows={3} value={evaluationText[key]} onChange={e=>{setEvaluationText(previous=>({...previous,[key]:e.target.value}));updateEvaluation(key,e.target.value.split('\n').filter(v=>v.trim()));}} /></label>)}
      <fieldset className="space-y-2"><legend>Etapas que precisam ser retomadas</legend>{session.plan.steps.map(step=><label key={step.key} className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={(draft.evaluation_json.revisitStepKeys??[]).includes(step.key)} onChange={e=>updateEvaluation('revisitStepKeys',e.target.checked?[...(latest.current.evaluation_json.revisitStepKeys??[]),step.key]:(latest.current.evaluation_json.revisitStepKeys??[]).filter(k=>k!==step.key))} />{step.title}</label>)}</fieldset>
    </fieldset>
    <p role="status" className="text-sm text-white/70">{saving?'Salvando…':generation.current>savedGeneration?'Alterações aguardando salvamento.':'Registro salvo.'}</p>
    {error && <div role="alert"><p>{error}</p><button type="button" className={button} disabled={saving} onClick={()=>void flush()}>Tentar salvar novamente</button><p className="mt-2 text-sm">Se houver conflito entre abas, copie suas anotações antes de recarregar a página.</p></div>}
    <div className="border-t border-white/15 pt-4">
      {confirmed?<p role="status">Atividade curricular confirmada em {new Date(confirmed).toLocaleString('pt-BR')}.</p>:<><p className="mb-3 text-sm">Após encerrar o encontro, confirme explicitamente a atividade curricular. A confirmação pode ocorrer com etapas pendentes e registra sua decisão pedagógica.</p><button type="button" className={button} disabled={meetingStatus!=='completed' || saving || confirming} onClick={()=>void confirm()}>{confirming?'Confirmando…':'Confirmar atividade curricular do aluno'}</button></>}
    </div>
  </article>;
}

export default function TeacherLearningPanel({scheduledLessonId,meetingStatus}: {scheduledLessonId:string;meetingStatus:string}) {
  const [workspace,setWorkspace]=useState<TeacherWorkspace|null>(null);
  const [error,setError]=useState('');
  const [selected,setSelected]=useState('');
  const [linking,setLinking]=useState(false);
  const load=useCallback(async()=>{
    try {setError('');setWorkspace(await teacherLearningRpc<TeacherWorkspace>('teacher_learning_workspace',{p_scheduled_lesson_id:scheduledLessonId}));}
    catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar o plano.');}
  },[scheduledLessonId]);
  useEffect(()=>{void load();},[load]);
  const link=async()=>{
    setLinking(true);setError('');
    try {setWorkspace(await teacherLearningRpc<TeacherWorkspace>('link_teacher_learning_activity',{p_scheduled_lesson_id:scheduledLessonId,p_activity_id:selected}));setSelected('');}
    catch(e){setError(e instanceof Error?e.message:'Não foi possível vincular a atividade.');}
    finally {setLinking(false);}
  };
  return <section className="mt-8 space-y-5 text-white" aria-label="Painel pedagógico da professora">
    <h2 className="text-2xl font-bold">Plano do encontro</h2>
    {error && <div role="alert" className={surface}><p>{error}</p>{!workspace && <button className={button} onClick={()=>void load()}>Tentar carregar novamente</button>}</div>}
    {!workspace && !error && <p role="status">Carregando plano pedagógico…</p>}
    {workspace && <>
      <div className={surface}><label className="block">Vincular atividade curricular<select aria-label="Vincular atividade curricular" className={field} disabled={linking || meetingStatus==='cancelled'} value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Selecione um encontro do currículo</option>{workspace.activities.filter(a=>!workspace.sessions.some(s=>s.activity_id===a.id)).map(a=><option key={a.id} value={a.id}>{a.course_title} / {a.module_title} / {a.submodule_title} / {a.lesson_title} — {a.title}</option>)}</select></label><button type="button" className={`${button} mt-3`} disabled={!selected || linking || meetingStatus==='cancelled'} onClick={()=>void link()}>{linking?'Vinculando…':'Vincular plano ao encontro'}</button>
        {!workspace.activities.length && <p className="mt-3 text-sm">Nenhuma atividade online publicada está disponível no currículo liberado deste aluno.</p>}
        {!workspace.sessions.length && <p className="mt-3 text-sm">Este encontro ainda não possui plano vinculado.</p>}
      </div>
      {workspace.sessions.map(s=><SessionPlan key={s.id} session={s} meetingStatus={meetingStatus} />)}
    </>}
  </section>;
}
