import {useEffect,useRef,useState} from 'react';
import {PresentationFrame} from '../learning/PresentationFrame';
import {bindPresentation,fetchPresentationState,localPresentationBundle,managedPresentationPath,parseWebPresentation,publishPresentation,resolvePresentationBundle,savePresentationPackage} from '../../lib/webPresentations';
import type {ParsedPresentation,PresentationBundle,PresentationState} from '../../types/presentations';

export default function WebPresentationManager({lessonId,onClose}:{lessonId:string;onClose:()=>void}){
  const [state,setState]=useState<PresentationState|null>(null);const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const [selectedId,setSelectedId]=useState('');const [versionId,setVersionId]=useState('');const [targetId,setTargetId]=useState('');
  const [file,setFile]=useState<File|null>(null);const [parsed,setParsed]=useState<ParsedPresentation|null>(null);
  const [preview,setPreview]=useState<PresentationBundle|null>(null);const [previewed,setPreviewed]=useState<string|null>(null);
  const [approved,setApproved]=useState(false);const [bindingReview,setBindingReview]=useState(false);const [bindApproved,setBindApproved]=useState(false);
  const [busy,setBusy]=useState(false);const inFlight=useRef(false);const disposePreview=useRef<(()=>void)|null>(null);
  useEffect(()=>{
    let alive=true;
    fetchPresentationState(lessonId).then(next=>{if(alive){setState(next);setError('');}}).catch(cause=>{if(alive)setError(cause.message);});
    return ()=>{alive=false;disposePreview.current?.();};
  },[lessonId]);
  const selected=state?.presentations.find(p=>p.id===selectedId);
  const version=selected?.versions.find(v=>v.id===(versionId||selected.active_version_id||selected.versions[0]?.id));
  const active=selected?.versions.find(v=>v.id===selected.active_version_id);
  const target=state?.activities.find(a=>a.id===targetId);
  const duplicate=parsed&&state?.presentations.some(p=>p.versions.some(v=>v.package_hash===parsed.packageHash));
  async function run(action:()=>Promise<void>){
    if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');setNotice('');
    try{await action();}catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível concluir a operação.');}
    finally{inFlight.current=false;setBusy(false);}
  }
  function clearPreview(){disposePreview.current?.();disposePreview.current=null;setPreview(null);setPreviewed(null);setApproved(false);}
  async function reload(){const next=await fetchPresentationState(lessonId);setState(next);setApproved(false);setBindingReview(false);setBindApproved(false);return next;}
  function choosePresentation(id:string){setSelectedId(id);setVersionId('');setTargetId('');setBindingReview(false);setBindApproved(false);clearPreview();}
  function chooseZip(next:File){
    void run(async()=>{
      clearPreview();setParsed(null);setFile(null);
      const result=await parseWebPresentation(next);
      setParsed(result);setFile(next);setNotice(`Pacote válido: ${result.slideCount} slides e ${result.files.length} arquivos. Ainda não foi enviado nem publicado.`);
    });
  }
  return <section aria-label="Gerenciador de apresentações web" className="mt-5 min-w-0 space-y-5 rounded-3xl border border-brand-purple/50 bg-background p-4 md:p-6" aria-busy={busy}>
    <header className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-bold text-white">Apresentações web</h3><button type="button" className="btn-secondary" disabled={busy} onClick={onClose}>Fechar gerenciador</button></header>
    <p className="text-sm leading-6 text-white/65">Importe o ZIP, confira a prévia e salve uma versão privada. Publicar uma versão e vinculá-la a uma atividade são ações separadas. Visualizar não registra estudo ou XP.</p>
    <div className="flex flex-wrap gap-3"><button type="button" className="btn-secondary" disabled={busy} onClick={()=>void run(async()=>{await reload();})}>Atualizar lista</button>{busy&&<p role="status" className="self-center text-sm text-white/70">Processando…</p>}</div>
    {error&&<p role="alert" className="whitespace-pre-wrap break-words rounded-2xl border border-red-300/30 bg-red-300/5 p-4 text-sm text-red-100">{error}</p>}
    {notice&&<p role="status" className="break-words text-sm text-brand-ice">{notice}</p>}
    {!state&&!error&&<p role="status" className="text-white/70">Consultando apresentações da aula…</p>}
    {state&&<>
      <label className="block text-sm text-white/80">Apresentação<select aria-label="Apresentação" className="mt-2 w-full rounded-xl bg-surface p-3 text-white ring-1 ring-white/20" value={selectedId} disabled={busy} onChange={event=>choosePresentation(event.target.value)}><option value="">Nova apresentação</option>{state.presentations.map(p=><option key={p.id} value={p.id}>{p.title} · {p.active_version_id?'Publicada':'Rascunho'}</option>)}</select></label>
      <label className="block text-sm text-white/80">Pacote ZIP<input className="mt-2 block w-full rounded-xl bg-surface p-3 text-white ring-1 ring-white/20" type="file" accept=".zip,application/zip" disabled={busy} onChange={event=>{const next=event.target.files?.[0];if(next)chooseZip(next);event.target.value='';}}/></label>
      <p className="text-xs leading-6 text-white/55">Até 10 MB. Um JSON v1 (apresentacao.json ou decks/nome.json), imagens WebP/PNG/JPEG em images/ e créditos opcionais em creditos-imagens.md. SVGs e arquivos de administração não são aceitos no ZIP.</p>
      {parsed&&<section aria-label="Arquivos validados" className="space-y-3 rounded-2xl border border-white/10 p-4">
        <h4 className="font-bold text-white">{parsed.deck.title} · {parsed.slideCount} slides</h4>
        <ul className="space-y-2 text-xs text-white/65">{parsed.files.map(item=><li key={item.path} className="break-all">{item.sourcePath} · {(item.size/1024).toFixed(1)} KB · {item.mime}</li>)}</ul>
        {parsed.warnings.length>0&&<div><h5 className="font-semibold text-amber-100">Avisos para revisão</h5><ul className="mt-2 space-y-2 text-sm text-amber-100/80">{parsed.warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul></div>}
        {duplicate&&<p role="status" className="text-sm text-amber-100">Este pacote já existe nesta aula. Selecione a apresentação e a versão salvas para publicar ou reverter.</p>}
        <div className="flex flex-wrap gap-3"><button type="button" className="btn-secondary" disabled={busy} onClick={()=>{clearPreview();const local=localPresentationBundle(parsed);disposePreview.current=local.dispose;setPreview(local.bundle);}}>Pré-visualizar pacote</button>
          <button type="button" className="btn-primary" disabled={busy||!file||Boolean(duplicate)} onClick={()=>void run(async()=>{
            if(!file)return;const result=await savePresentationPackage(lessonId,selected?.id??null,file);await reload();setSelectedId(result.presentationId);setVersionId(result.versionId);clearPreview();setParsed(null);setFile(null);setNotice(`Versão ${result.versionNumber} salva e validada no servidor. Ainda não publicada.`);
          })}>Salvar rascunho validado</button></div>
      </section>}
      {selected&&<section aria-label="Versões da apresentação" className="space-y-4 rounded-2xl border border-white/10 p-4">
        <p className="text-sm text-white/75">{active?`Publicada: versão ${active.version_number}`:'Nenhuma versão publicada. Os rascunhos são privados.'}</p>
        <label className="block text-sm text-white/80">Versão<select aria-label="Versão" className="mt-2 w-full rounded-xl bg-surface p-3 text-white ring-1 ring-white/20" disabled={busy} value={version?.id??''} onChange={event=>{setVersionId(event.target.value);clearPreview();}}>{selected.versions.map(v=><option key={v.id} value={v.id}>Versão {v.version_number} · {v.id===selected.active_version_id?'Ativa':'Inativa / rascunho'} · {v.slide_count} slides</option>)}</select></label>
        {version&&<>
          <p className="break-all text-xs text-white/50">SHA-256 do pacote: {version.package_hash}</p>
          <details className="text-sm text-white/65"><summary className="cursor-pointer">Arquivos da versão</summary><ul className="mt-3 space-y-2 text-xs">{version.files.map(item=><li key={item.path} className="break-all">{item.path} · {(item.size/1024).toFixed(1)} KB · {item.mime}</li>)}</ul></details>
          {version.warnings.length>0&&<div className="text-sm text-amber-100"><p className="font-semibold">Avisos desta versão</p><ul className="mt-2 space-y-2">{version.warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul></div>}
          <button type="button" className="btn-secondary" disabled={busy} onClick={()=>void run(async()=>{clearPreview();setPreview(await resolvePresentationBundle(selected.id,version.id));setPreviewed(version.id);})}>Visualizar versão salva</button>
          {version.id!==selected.active_version_id&&<>
            <label className="flex items-start gap-3 text-sm text-white/80"><input type="checkbox" className="mt-1" checked={approved} disabled={busy||previewed!==version.id} onChange={event=>setApproved(event.target.checked)}/>Revisei esta versão na prévia, incluindo textos, imagens, créditos e licenças, e confirmo a troca da versão ativa.</label>
            <button type="button" className="btn-primary" disabled={busy||!approved||previewed!==version.id} onClick={()=>void run(async()=>{await publishPresentation(selected.id,version.id,selected.active_version_id);await reload();setApproved(false);setNotice(`Versão ${version.version_number} ativada. Os vínculos e o progresso foram preservados.`);})}>{active&&version.version_number<active.version_number?`Reverter para versão ${version.version_number}`:`Publicar versão ${version.version_number}`}</button>
          </>}
        </>}
        {active&&<div className="min-w-0 space-y-2"><p className="text-sm text-white/70">URL estável · requer conta com acesso à aula:</p><a className="block break-all text-sm text-brand-ice underline" href={managedPresentationPath(selected.id)} target="_blank" rel="noopener noreferrer">{window.location.origin}{managedPresentationPath(selected.id)}</a><button type="button" className="btn-secondary" onClick={()=>void run(async()=>{await navigator.clipboard.writeText(window.location.origin+managedPresentationPath(selected.id));setNotice('URL copiada.');})}>Copiar URL</button></div>}
      </section>}
      {selected?.active_version_id&&<section aria-label="Vincular apresentação à atividade" className="space-y-4 rounded-2xl border border-white/10 p-4">
        <h4 className="font-bold text-white">Vincular a uma atividade existente</h4>
        {!state.activities.length?<p className="text-sm text-white/65">Esta aula não tem atividade slides disponível. O gerenciador não cria nem duplica atividades.</p>:<>
          <label className="block text-sm text-white/80">Atividade slides<select aria-label="Atividade slides" className="mt-2 w-full rounded-xl bg-surface p-3 text-white ring-1 ring-white/20" value={targetId} disabled={busy} onChange={event=>{setTargetId(event.target.value);setBindingReview(false);setBindApproved(false);}}><option value="">Escolha a atividade de destino</option>{state.activities.map(a=><option key={a.id} value={a.id}>{a.title} · {a.key}</option>)}</select></label>
          <button type="button" className="btn-secondary" disabled={busy||!target} onClick={()=>setBindingReview(true)}>Revisar vínculo proposto</button>
          {bindingReview&&target&&<div className="space-y-3 rounded-xl bg-surface p-4 text-sm text-white/75">
            <p className="break-all">Atividade: {target.title} · key {target.key} · UUID {target.id}</p><p className="break-all">Referência original preservada: {target.resource_url||'Sem URL'}</p><p className="break-all">Vínculo atual: {target.presentation_id??'Nenhum'} → apresentação {selected.id}</p>
            <p>O vínculo auxiliar altera o material aberto por esta atividade. UUID, key, revisão, obrigatoriedade, conclusão e XP permanecem iguais.</p>
            <label className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={bindApproved} disabled={busy} onChange={event=>setBindApproved(event.target.checked)}/>Confirmo esta atividade como destino do vínculo apresentado.</label>
            <button type="button" className="btn-primary" disabled={busy||!bindApproved} onClick={()=>void run(async()=>{await bindPresentation(selected.id,target.id,target.presentation_id);await reload();setBindingReview(false);setBindApproved(false);setNotice('Vínculo salvo. Nenhuma atividade foi reimportada ou duplicada.');})}>Confirmar vínculo</button>
          </div>}
        </>}
      </section>}
    </>}
    {preview&&<section aria-label="Prévia de slides sem progresso" className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><h4 className="font-bold text-white">Prévia · sem progresso ou XP</h4><button type="button" className="btn-secondary" onClick={clearPreview}>Fechar prévia</button></div><PresentationFrame bundle={preview}/></section>}
  </section>;
}
