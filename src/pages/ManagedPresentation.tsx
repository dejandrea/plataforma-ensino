import {useEffect,useState} from 'react';
import {useParams} from 'react-router-dom';
import {PresentationFrame} from '../components/learning/PresentationFrame';
import {resolvePresentationBundle} from '../lib/webPresentations';
import type {PresentationBundle} from '../types/presentations';

export function ManagedPresentation(){
  const {id}=useParams();const [bundle,setBundle]=useState<PresentationBundle|null>(null);const [error,setError]=useState('');const [reload,setReload]=useState(0);
  useEffect(()=>{
    let alive=true;
    const load=async()=>{try{const next=await resolvePresentationBundle(id??'');if(alive){setBundle(next);setError('');}}catch(cause){if(alive)setError(cause instanceof Error?cause.message:'Apresentação indisponível.');}};
    void load();const timer=window.setInterval(()=>void load(),120000);
    return ()=>{alive=false;window.clearInterval(timer);};
  },[id,reload]);
  return <main className="app-bg min-h-screen px-3 py-5 md:px-6"><div className="mx-auto max-w-7xl space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-white/65">Feche esta aba para retornar à aula. A confirmação do estudo acontece na aula.</p><button type="button" className="btn-secondary" onClick={()=>setReload(value=>value+1)}>Atualizar apresentação</button></div>
    {error&&<p role="alert" className="rounded-2xl border border-amber-300/30 p-4 text-amber-100">{error}</p>}
    {!bundle&&!error&&<p role="status" className="text-white/70">Carregando apresentação autorizada…</p>}
    {bundle&&!error&&<PresentationFrame bundle={bundle} title={bundle.deck.title}/>}
  </div></main>;
}
