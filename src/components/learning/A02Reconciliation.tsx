import {useRef,useState} from 'react';
import {applyA02Reconciliation,planA02Reconciliation} from '../../lib/a02Reconciliation';
import type {A02ReconciliationPlan} from '../../lib/a02Reconciliation';
import type {LessonImport} from '../../types/learning';

const labels:Record<string,string>={title:'Título',description:'Descrição',order_index:'Posição',duration_minutes:'Duração',is_required:'Obrigatoriedade',content_json:'Material',gamification_json:'Regra de recompensa',activity_type:'Tipo'};
export default function A02Reconciliation({document,onSaved}:{document:LessonImport;onSaved:(newIds:string[])=>void}){
  const [plan,setPlan]=useState<A02ReconciliationPlan|null>(null);
  const [confirmed,setConfirmed]=useState(false);const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');const [notice,setNotice]=useState('');const inFlight=useRef(false);
  async function run(action:()=>Promise<void>){
    if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');setNotice('');
    try{await action();}catch(cause){setPlan(null);setConfirmed(false);setError(cause instanceof Error?cause.message:'Não foi possível reconciliar a aula.');}
    finally{inFlight.current=false;setBusy(false);}
  }
  return <section aria-label="Atualização segura da Aula 02" className="space-y-4 rounded-2xl border border-brand-ice/30 p-4" aria-busy={busy}>
    <h4 className="font-bold text-white">Atualizar a Aula 02 sem duplicar</h4>
    <p className="text-sm leading-6 text-white/70">Compare as oito atividades com o banco antes de salvar. UUIDs, keys e gabaritos existentes serão preservados. A operação é bloqueada se houver histórico de aluno. Atividades novas serão salvas como rascunhos.</p>
    <button type="button" className="btn-secondary" disabled={busy} onClick={()=>void run(async()=>{setConfirmed(false);setPlan(await planA02Reconciliation(document));})}>{busy?'Processando…':'Comparar com as atividades existentes'}</button>
    {error&&<p role="alert" className="text-sm text-red-200">{error}</p>}
    {notice&&<p role="status" className="text-sm text-brand-ice">{notice}</p>}
    {plan&&<>
      <div className="space-y-2 text-sm text-white/75"><p className="font-bold">Confirme a aula de destino</p>
        <p>Banco: {Object.values(plan.actualContext).join(' / ')} / Grandes Nomes da Tecnologia</p>
        <p>Arquivo: {Object.values(plan.documentContext).join(' / ')} / Grandes Nomes da Tecnologia</p>
        <p>Diferenças de nomes do contexto não renomeiam curso, módulo ou submódulo. O destino é a Aula 02 identificada pelo UUID.</p>
      </div>
      <ul className="space-y-3">{plan.activities.map(a=><li key={a.key} className="min-w-0 space-y-2 rounded-xl bg-background p-3 text-sm text-white/80">
        <p className="font-bold">{a.after.title} · {a.action==='insert'?'Inserir rascunho':a.action==='keep'?'Manter':'Atualizar'}</p>
        <p className="break-all text-xs">{a.key} · UUID: {a.id??'novo registro'}</p>
        <p>Posição: {a.before?.order_index??'—'} → {a.after.order_index} · {a.before?(a.before.is_required?'Obrigatória':'Opcional'):'Nova'} → {a.after.is_required?'Obrigatória':'Opcional'}</p>
        <p>Alterações: {a.changedFields.map(f=>labels[f]??f).join(', ')||'Nenhuma'}</p>
        <details><summary className="cursor-pointer text-brand-ice">Revisar antes e depois</summary><div className="mt-3 grid min-w-0 gap-3 md:grid-cols-2">{[['Antes',a.before],['Depois',a.after]].map(([label,value])=><div key={String(label)} className="min-w-0"><h5 className="font-bold">{String(label)}</h5><pre className="mt-2 whitespace-pre-wrap break-words text-xs">{JSON.stringify(value,null,2)}</pre></div>)}</div></details>
      </li>)}</ul>
      <details className="text-sm text-white/75"><summary className="cursor-pointer">Descrição, duração e objetivos da aula</summary><pre className="mt-3 whitespace-pre-wrap break-words text-xs">{JSON.stringify({antes:{...plan.lessonBefore,objectives:plan.objectivesBefore},depois:{...plan.lessonAfter,objectives:plan.objectivesAfter}},null,2)}</pre></details>
      <label className="flex items-start gap-3 text-sm text-white"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>Revisei o destino, os materiais, a ordem e a obrigatoriedade. Confirmo preservar os registros existentes e salvar as atividades novas como rascunhos, sem publicar a aula nem alterar vínculos web.</label>
      <button type="button" className="btn-primary" disabled={busy||!confirmed} onClick={()=>void run(async()=>{const result=await applyA02Reconciliation(document,plan.token);setPlan(null);setConfirmed(false);setNotice('Aula reconciliada. Novas atividades em rascunho; nenhuma publicação ou vínculo foi alterado.');onSaved(result.newActivityIds);})}>Salvar atualização revisada</button>
    </>}
  </section>;
}
