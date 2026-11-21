import {useEffect,useMemo,useState} from 'react';
import {compareEditorialLesson,loadEditorialLesson,publishEditorialDraft,sameEditorialDocument,saveEditorialDraft} from '../../lib/editorialLessons';
import type {EditorialPlan,EditorialState} from '../../lib/editorialLessons';
import {toStudentLesson,validateLessonImport} from '../../lib/learningContent';
import type {LearningActivity} from '../../types/learning';
import {useLessonChanges} from '../../lib/lessonChanges';
import AdminLessonPreview from './AdminLessonPreview';
const labels:Record<string,string>={new:'Novo',unchanged:'Sem alterações',editorial:'Editorial',resource:'Recurso',structural:'Estrutural',pedagogical:'Pedagógico',conflict:'Conflito',incompatible:'Incompatível'};
export default function EditorialLessonEditor({lessonId,onClose,workspaceView,onStateChange}:{lessonId:string;onClose:()=>void;workspaceView?:'edit'|'publication';onStateChange?:(state:EditorialState)=>void}){
 const [state,setState]=useState<EditorialState|null>(null);const [source,setSource]=useState('');
 const [plan,setPlan]=useState<EditorialPlan|null>(null);const [identity,setIdentity]=useState(false);
 const [confirmation,setConfirmation]=useState(false);const [busy,setBusy]=useState(true);
 const [message,setMessage]=useState('');const [preview,setPreview]=useState(false);const [generation,setGeneration]=useState(0);
 const [baseline,setBaseline]=useState('');
 useLessonChanges('editorial',source!==baseline,busy);
 useEffect(()=>{if(state)onStateChange?.(state);},[state,onStateChange]);
 useEffect(()=>{
 let active=true;
 loadEditorialLesson(lessonId).then(result=>{
 if(active){const text=JSON.stringify(result.draft?.status==='draft'?result.draft.document:result.document,null,2);setState(result);setSource(text);setBaseline(text);setPlan(null);setIdentity(false);setConfirmation(false);}
 }).catch(error=>{if(active)setMessage(error instanceof Error?error.message:'Falha ao abrir a aula.');})
 .finally(()=>{if(active)setBusy(false);});return ()=>{active=false;};
 },[lessonId,generation]);
 const validation=useMemo(()=>{if(new TextEncoder().encode(source).byteLength>2000000)return {valid:false as const,errors:['O arquivo JSON deve ter no máximo 2.000.000 bytes UTF-8.']};try{return validateLessonImport(JSON.parse(source));}catch{return {valid:false as const,errors:['Informe um JSON válido.']};}},[source]);
 const saved=state?.draft;
 const matchesDraft=saved?.status==='draft'&&validation.valid&&sameEditorialDocument(validation.data,saved.document);
 const previewRows=useMemo(()=>{
 if(!validation.valid)return [];
 return toStudentLesson(plan?.document??validation.data).activities.map(a=>({id:a.key,lesson_id:lessonId,key:a.key,title:a.title,description:a.description??null,
 activity_type:a.type,content_json:a.content,order_index:a.orderIndex,duration_minutes:a.durationMinutes??null,is_required:a.required,
 is_active:true,publication_status:'draft',revision:1,created_at:'',updated_at:'',published_at:null,is_unlocked:true,prerequisite_ids:[]} as LearningActivity));
 },[validation,plan,lessonId]);
 function change(value:string){setSource(value);setPlan(null);setConfirmation(false);setPreview(false);setMessage('');}
 async function act(operation:()=>Promise<void>){setBusy(true);setMessage('');try{await operation();}catch(error){setMessage(error instanceof Error?error.message:'Operação não concluída.');}finally{setBusy(false);}}
 return <section aria-label="Fundação editorial da aula" className="my-5 min-w-0 space-y-4 rounded-3xl border border-brand-purple/40 p-4 text-white">
 <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-bold">Conteúdo e rascunho editorial</h3><button className="btn-secondary" disabled={busy} onClick={onClose}>Fechar editor</button></div>
 <p className="text-sm text-white/75">Salve um rascunho privado e publique em uma ação separada. Atividades omitidas serão preservadas. O status curricular da aula será mantido.</p>
 {busy&&<p role="status">Processando…</p>}{message&&<p role="status" className="whitespace-pre-wrap break-words">{message}</p>}
 {state?.hasHistory&&<p role="alert">Esta aula possui histórico de aprendizagem. Alterações estão bloqueadas até o versionamento pedagógico.</p>}
 {state&&<>
 <p className="font-semibold">Aula selecionada: {state.lessonTitle}</p>
 {saved?.status==='draft'&&<p>Rascunho privado recuperado · versão {saved.version}.</p>}
 {workspaceView==='publication'&&saved?.status!=='draft'&&<p role="status">Nenhum rascunho editorial pendente. Prepare o documento na aba Atividades antes de publicar.</p>}
 <div hidden={workspaceView==='publication'} className="space-y-4">
 <p className="text-sm text-white/65">Use o contrato JSON existente. Na primeira edição, confira a aula selecionada e informe sua key estável. Aulas vazias precisam de ao menos uma atividade válida.</p>
 <label className="block">Abrir JSON<input className="mt-2 block max-w-full" type="file" accept=".json,application/json" disabled={busy} onChange={e=>{
 const file=e.target.files?.[0];if(!file)return;if(file.size>2000000){setMessage('O JSON deve ter no máximo 2 MB.');return;}
 void file.text().then(change).catch(()=>setMessage('Não foi possível ler o arquivo.'));e.target.value='';}}/></label>
 <label className="block" htmlFor={`editorial-json-${lessonId}`}>Documento da aula</label>
 <textarea id={`editorial-json-${lessonId}`} value={source} disabled={busy} onChange={e=>change(e.target.value)} spellCheck={false} className="min-h-72 w-full max-w-full rounded-xl bg-background p-3 font-mono text-sm"/>
 {!validation.valid&&<details><summary>Validação do documento</summary><ul>{validation.errors.slice(0,20).map((error,i)=><li key={i} className="break-words">{error}</li>)}</ul></details>}
 </div>
 <div className="flex flex-wrap gap-3">
 <button className="btn-secondary" disabled={busy} onClick={()=>{if(source!==baseline&&!window.confirm('Descartar as alterações locais e recarregar a aula?'))return;setBusy(true);setGeneration(n=>n+1);}}>Recarregar aula e rascunho</button>
 <button className="btn-primary" disabled={busy||!validation.valid} onClick={()=>void act(async()=>{if(validation.valid){setPlan(await compareEditorialLesson(lessonId,validation.data));setConfirmation(false);}})}>Comparar sem salvar</button>
 <button className="btn-secondary" disabled={busy||!validation.valid} onClick={()=>setPreview(v=>!v)}>Prévia como aluno</button>
 </div>
 {preview&&<AdminLessonPreview lessonId={lessonId} activities={previewRows} onClose={()=>setPreview(false)}/>}
 {plan&&<>
 <h4 className="font-bold">Comparação do conteúdo final</h4>
 <p>Metadados: {plan.lessonClasses.map(c=>labels[c]??c).join(', ')}.</p>
 <details><summary>Metadados da aula: antes e depois</summary><pre className="overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify({antes:plan.lessonBefore,depois:plan.lessonAfter},null,2)}</pre></details>
 {plan.teacherChanges.length>0&&<details><summary>Alterações privadas de gabaritos e planos docentes</summary><pre className="whitespace-pre-wrap break-words text-xs">{JSON.stringify(plan.teacherChanges,null,2)}</pre></details>}
 <ul className="space-y-3">{plan.activities.map(item=><li key={item.key} className="min-w-0 rounded-xl border border-white/15 p-3">
 <p className="break-words font-semibold">{item.after.title} · {item.omitted?'Omitido: preservado':item.classes.map(c=>labels[c]??c).join(', ')}</p>
 <p className="text-sm text-white/65">Publicação da atividade: {item.publicationBefore==='published'?'publicada':item.publicationBefore==='draft'?'rascunho':'nova'} → {item.publicationAfter==='published'?'publicada':'rascunho'}.</p>
 <details><summary>Ver diferenças · {item.changedFields.join(', ')||'Nenhuma'}</summary><pre className="whitespace-pre-wrap break-words text-xs">{JSON.stringify({antes:item.before,depois:item.after},null,2)}</pre></details>
 </li>)}</ul>
 {plan.issues.length>0&&<ul role="alert">{plan.issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul>}
 {plan.needsIdentity&&<label className="flex gap-3"><input type="checkbox" checked={identity} disabled={busy} onChange={e=>setIdentity(e.target.checked)}/>Confirmo que a key {validation.valid?validation.data.lesson.key:''} pertence à aula {state.lessonTitle} selecionada no painel.</label>}
 <button className="btn-primary" disabled={busy||!plan.canSave||(plan.needsIdentity&&!identity)} onClick={()=>void act(async()=>{
 if(!validation.valid)return;const draft=await saveEditorialDraft(lessonId,validation.data,plan,identity);setState({...state,draft});setBaseline(source);setPlan(null);setConfirmation(false);setMessage('Rascunho privado salvo. Nenhuma atividade foi publicada.');
 })}>Salvar rascunho privado</button>
 </>}
 {matchesDraft&&workspaceView!=='edit'&&<div className="space-y-3 rounded-xl border border-brand-purple/40 p-4">
 <p>Publicar aplica o rascunho salvo e disponibiliza suas atividades. O servidor revalida conteúdo, histórico e concorrência.</p>
 <label className="flex gap-3"><input type="checkbox" checked={confirmation} disabled={busy||state.hasHistory} onChange={e=>setConfirmation(e.target.checked)}/>Revisei o rascunho salvo e aprovo publicar estas alterações.</label>
 <button className="btn-primary" disabled={busy||!confirmation||state.hasHistory} onClick={()=>void act(async()=>{if(!saved)return;await publishEditorialDraft(lessonId,saved);const updated=await loadEditorialLesson(lessonId);const text=JSON.stringify(updated.document,null,2);setState(updated);setSource(text);setBaseline(text);setPlan(null);setConfirmation(false);setMessage('Rascunho publicado. O status curricular da aula foi preservado.');})}>Publicar rascunho salvo</button>
 </div>}
 {state.events.length>0&&<details><summary>Operações editoriais recentes</summary><ul>{state.events.map(event=><li key={event.id}>{event.operation} · versão {event.draft_version} · {new Date(event.created_at).toLocaleString('pt-BR')}</li>)}</ul></details>}
 </>}
 </section>;
}
