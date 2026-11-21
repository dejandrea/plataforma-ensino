import {useEffect,useRef,useState} from 'react';
import {createPackageKit,downloadPackage,exportProductionKit,packageState,parseUnifiedLesson,publishPackage,saveUnifiedLesson,syntheticLessonPackage} from '../../lib/lessonPackages';
import type {PackageState,ParsedLessonPackage} from '../../lib/lessonPackages';
import {localPresentationBundle,resolvePresentationBundle} from '../../lib/webPresentations';
import {toStudentLesson} from '../../lib/learningContent';
import {compareEditorialLesson} from '../../lib/editorialLessons';
import type {LearningActivity} from '../../types/learning';
import type {PresentationBundle} from '../../types/presentations';
import {PresentationFrame} from './PresentationFrame';
import AdminLessonPreview from './AdminLessonPreview';
import {useLessonChanges} from '../../lib/lessonChanges';

export default function UnifiedLessonImporter({lessonId,onClose,workspaceView}:{lessonId:string;onClose:()=>void;workspaceView?:'import'|'publication'}){
 const [state,setState]=useState<PackageState|null>(null),[parsed,setParsed]=useState<ParsedLessonPackage|null>(null);
 const [file,setFile]=useState<File|null>(null),[approved,setApproved]=useState(false),[publishApproved,setPublishApproved]=useState(false);
 const [origin,setOrigin]=useState(window.location.protocol==='https:'?window.location.origin:'https://example.invalid');
 const [busy,setBusy]=useState(true),[message,setMessage]=useState(''),[showLesson,setShowLesson]=useState(false);
 const [deck,setDeck]=useState<PresentationBundle|null>(null);const dispose=useRef<(()=>void)|null>(null);const flight=useRef(false);
 const upload=useRef<HTMLInputElement>(null);
 useEffect(()=>{let alive=true;packageState(lessonId).then(next=>{if(alive){setState(next);if(next.kit)setOrigin(next.kit.origin);}}).catch(error=>{if(alive)setMessage(error.message);}).finally(()=>{if(alive)setBusy(false);});return()=>{alive=false;dispose.current?.();};},[lessonId]);
 async function run(action:()=>Promise<void>){if(flight.current)return;flight.current=true;setBusy(true);setMessage('');try{await action();}catch(error){setMessage(error instanceof Error?error.message:'Operação não concluída.');}finally{flight.current=false;setBusy(false);}}
 async function reload(){const next=await packageState(lessonId);setState(next);setPublishApproved(false);return next;}
 function clearPreview(){dispose.current?.();dispose.current=null;setDeck(null);}
 const op=state?.operation;const document=parsed?.document??op?.document;
 useLessonChanges('package',Boolean(parsed&&parsed.semanticHash!==op?.semantic_hash),busy&&Boolean(file));
 const activities=document?toStudentLesson(document).activities.map(a=>({id:a.key,key:a.key,lesson_id:lessonId,title:a.title,description:a.description??null,activity_type:a.type,content_json:a.content,order_index:a.orderIndex,duration_minutes:a.durationMinutes??null,is_required:a.required,is_active:true,publication_status:'draft',revision:1,published_at:null,created_at:'',updated_at:'',is_unlocked:true,prerequisite_ids:[]} as LearningActivity)):[];
 return <section aria-label="Importador unificado de aula" className="my-5 min-w-0 space-y-4 break-words rounded-3xl border border-brand-purple/40 p-4 text-white">
 <div className="flex flex-wrap justify-between gap-3"><h3 className="text-xl font-bold">Uma aula · um pacote ZIP</h3><button className="btn-secondary" disabled={busy} onClick={onClose}>Fechar pacote</button></div>
 <p className="text-sm text-white/70">Primeira importação em aula curricular vazia e sem histórico. Materiais continuam no Drive. Salvar prepara apresentações privadas e rascunho; publicar é uma ação separada e não muda o status curricular da aula.</p>
 {busy&&<p role="status">Processando pacote…</p>}{message&&<p role="status" className="whitespace-pre-wrap break-words">{message}</p>}
 {state&&<>
 <div hidden={workspaceView==='publication'} className="space-y-4">
 {!state.eligible&&op?.status!=='published'&&<p role="alert">{state.eligibilityReason??'Aula não elegível.'} Nenhum conteúdo será substituído.</p>}
 <label className="block">Origem HTTPS da plataforma<input type="url" value={origin} disabled={busy||Boolean(state.kit)} onChange={e=>setOrigin(e.target.value)} className="mt-2 w-full rounded-xl bg-background p-3"/></label>
 <div className="flex flex-wrap gap-3">
 <button className="btn-secondary" disabled={busy||!state.eligible} onClick={()=>void run(async()=>{const kit=await createPackageKit(lessonId,origin);downloadPackage(await exportProductionKit(kit),`kit-work-${kit.lesson_key}.zip`);await reload();setMessage('Kit exportado com identidade real, schemas e exemplo sintético.');})}>Exportar kit para o Work</button>
 <button className="btn-secondary" disabled={busy||!state.eligible} onClick={()=>void run(async()=>{const kit=await createPackageKit(lessonId,origin);downloadPackage(await syntheticLessonPackage(kit),`bitaria-${kit.lesson_key}-demonstracao-local-v1.zip`);await reload();setMessage('Exemplo sintético: use somente para demonstração em ambiente de testes.');})}>Baixar pacote sintético</button>
 <button className="btn-secondary" disabled={busy} onClick={()=>void run(async()=>{await reload();setMessage('Operação recuperada do servidor.');})}>Recuperar operação</button>
 </div>
 {!state.kit&&<p>Exporte o kit antes de importar: ele reserva as identidades das apresentações.</p>}
 <div className="space-y-3 rounded-2xl border border-brand-lavender/40 bg-brand-purple/10 p-4">
 <h4 className="font-bold">Importar o pacote final da aula</h4>
 <p id={`package-upload-help-${lessonId}`} className="text-sm text-white/70">Selecione o ZIP produzido pelo Work, com manifest.json e aula.json. Não envie o Kit Work. Primeiro você confere a validação e a prévia; salvar o rascunho é uma confirmação separada.</p>
 <button type="button" className="btn-primary" disabled={busy||!state.kit} aria-describedby={`package-upload-help-${lessonId}`} onClick={()=>upload.current?.click()}>Importar ZIP da aula</button>
 {file&&<p className="break-all text-sm text-white/70">Arquivo selecionado: {file.name}</p>}
 <input ref={upload} aria-label="Pacote ZIP completo" className="hidden" type="file" accept=".zip,application/zip" disabled={busy||!state.kit} onChange={e=>{const next=e.target.files?.[0];e.target.value='';if(!next||!state.kit)return;setParsed(null);setFile(null);setApproved(false);setPublishApproved(false);clearPreview();void run(async()=>{
 const value=await parseUnifiedLesson(next,state.kit!);
 if(value.semanticHash!==op?.semantic_hash){if(op&&op.status!=='published')throw new Error('Existe operação pendente com conteúdo diferente. Reenvie o mesmo pacote para retomar.');const comparison=await compareEditorialLesson(lessonId,value.document);if(!comparison.canSave)throw new Error(comparison.issues.join('\n'));}
 setParsed(value);setFile(next);setMessage('Pacote válido. Revise a prévia e confirme salvar o rascunho.');});}}/>
 </div>
 {parsed&&<>
 <h4 className="font-bold">{parsed.document.lesson.title} · {parsed.document.activities.length} atividades · {parsed.decks.length} apresentações</h4>
 <ul className="list-disc pl-5 text-sm">{parsed.warnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul>
 <details><summary>Inventário de recursos e referências</summary><ul>{parsed.resources.map((r,i)=><li key={i} className="break-all">{r.private?'Privado':'Público'} · {r.kind} · {r.url}</li>)}</ul></details>
 <div className="flex flex-wrap gap-3">{parsed.decks.map(item=><button key={item.key} className="btn-secondary" onClick={()=>{clearPreview();const local=localPresentationBundle(item.parsed);dispose.current=local.dispose;setDeck(local.bundle);}}>Prévia {item.key}</button>)}</div>
 <label className="flex gap-3"><input type="checkbox" checked={approved} disabled={busy} onChange={e=>setApproved(e.target.checked)}/>Revisei destino, conteúdos, gabaritos e apresentações. Confirmo salvar como rascunho privado.</label>
 <button className="btn-primary" disabled={busy||!approved||!file} onClick={()=>void run(async()=>{if(!file)return;const result=await saveUnifiedLesson(lessonId,file);await reload();setApproved(false);setMessage(result.status==='published'?'Operação já publicada recuperada, sem nova publicação.':'Rascunho privado salvo com intenções de vínculo. Nada foi publicado.');})}>Salvar pacote em rascunho</button>
 </>}
 </div>
 {workspaceView==='publication'&&!op&&<p role="status">Nenhuma operação de pacote nesta aula. Prepare o pacote na aba Importar; não é necessário criar outro kit para recuperar uma operação existente.</p>}
 {document&&<button className="btn-secondary" onClick={()=>setShowLesson(v=>!v)}>Conferir atividades como aluno</button>}
 {showLesson&&document&&<AdminLessonPreview lessonId={lessonId} activities={activities} onClose={()=>setShowLesson(false)}/>}
 {op&&<div className="space-y-3 rounded-xl border border-white/15 p-4">
 <h4 className="font-bold">Operação {op.status==='preparing'?'em preparação':op.status==='ready'?'pronta em rascunho':'publicada'}</h4>
 {op.last_error&&<p role="alert" className="break-words">{op.last_error}</p>}
 {op.status==='preparing'&&<p>Preparação interrompida ou em andamento. Reenvie o mesmo ZIP para retomar sem duplicar recursos.</p>}
 <ul>{op.intents.map(intent=><li key={intent.key} className="my-2 flex flex-wrap items-center gap-3"><span className="min-w-0 max-w-full break-words">{intent.activity_key} → {intent.key}</span><button className="btn-secondary" disabled={busy} onClick={()=>void run(async()=>{clearPreview();setDeck(await resolvePresentationBundle(intent.presentation_id,intent.version_id));})}>Conferir apresentação {intent.key}</button></li>)}</ul>
 {op.status==='ready'&&workspaceView!=='import'&&<>
 <p>Publicar aplica atividades, versões e vínculos em uma única transação. Histórico e concorrência serão verificados novamente.</p>
 <label className="flex gap-3"><input type="checkbox" checked={publishApproved} disabled={busy} onChange={e=>setPublishApproved(e.target.checked)}/>Revisei o rascunho recuperado e aprovo publicar o conjunto.</label>
 <button className="btn-primary" disabled={busy||!state.eligible||!publishApproved||(parsed!==null&&parsed.semanticHash!==op.semantic_hash)} onClick={()=>void run(async()=>{await publishPackage(op);await reload();setMessage('Conjunto publicado: atividades, versões e vínculos consistentes. O status curricular da aula foi preservado.');})}>Publicar conjunto revisado</button>
 </>}
 </div>}
 {deck&&<><button className="btn-secondary" onClick={clearPreview}>Fechar prévia da apresentação</button><PresentationFrame bundle={deck}/></>}
 </>}
 </section>;
}
