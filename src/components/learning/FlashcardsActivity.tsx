import {useEffect,useRef,useState} from 'react';
import {fetchFlashcardProgress,reviewFlashcard} from '../../lib/studentLearning';
import {shuffleCards} from '../../lib/flashcards';
import type {FlashcardImage,FlashcardsContent} from '../../types/learning';

function CardImage({image}:{image:FlashcardImage}) {
 const [failed,setFailed]=useState(false);
 return failed?<p className="text-sm text-amber-200">Imagem indisponível: {image.altText}</p>:<img src={image.resourceUrl} alt={image.altText} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)} className="mx-auto max-h-64 max-w-full rounded-2xl object-contain"/>;
}

export function FlashcardsActivity({activityId,revision,content,preview=false,disabled,onSaved,onBusyChange}:{
 activityId:string;revision:number;content:FlashcardsContent;preview?:boolean;disabled:boolean;
 onSaved:()=>Promise<void>;onBusyChange:(value:boolean)=>void;
}) {
 const [order,setOrder]=useState(()=>content.cards.map(c=>c.id));
 const [index,setIndex]=useState(0);
 const [back,setBack]=useState(false);
 const [reviewed,setReviewed]=useState<string[]>([]);
 const [completed,setCompleted]=useState(false);
 const [loading,setLoading]=useState(!preview);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [retry,setRetry]=useState(0);
 const alive=useRef(true);
 const inFlight=useRef(false);
 useEffect(()=>{
  alive.current=true;let current=true;
  if(!preview)fetchFlashcardProgress(activityId).then(state=>{
   if(!current)return;
   if(state.activity_revision!==revision)throw new Error('A atividade mudou. Recarregue a página.');
   setReviewed(state.reviewed_card_ids);setCompleted(state.completed);setLoading(false);setError('');
  }).catch(cause=>{if(current){setError(cause instanceof Error?cause.message:'Não foi possível carregar os cartões.');setLoading(false);}});
  return ()=>{current=false;alive.current=false;};
 },[activityId,revision,preview,retry]);
 const card=content.cards.find(c=>c.id===order[index]);
 if(!card)return <p role="alert">Cartões indisponíveis. Recarregue a aula.</p>;
 const locked=disabled||loading||busy;
 async function record() {
  if(!card||inFlight.current)return;
  if(preview){setReviewed(ids=>ids.includes(card.id)?ids:[...ids,card.id]);return;}
  inFlight.current=true;setBusy(true);setError('');onBusyChange(true);
  try {
   const result=await reviewFlashcard(activityId,card.id);
   if(result.activity_revision!==revision)throw new Error('A atividade mudou. Recarregue a página.');
   if(alive.current){setReviewed(result.reviewed_card_ids);setCompleted(result.completed);await onSaved();}
  } catch(cause) {if(alive.current)setError(cause instanceof Error?cause.message:'Não foi possível salvar a revisão.');}
  finally {inFlight.current=false;if(alive.current)setBusy(false);onBusyChange(false);}
 }
 function flip() {if(locked)return;setBack(value=>!value);if(!back)void record();}
 function move(position:number) {setIndex(position);setBack(false);setError('');}
 const saved=reviewed.includes(card.id);
 return <section aria-label="Cartões didáticos" className="min-w-0 space-y-5">
  {preview&&<p className="text-sm text-brand-ice">Prévia interativa — não salva progresso nem concede XP.</p>}
  <div className="flex flex-wrap justify-between gap-3 text-sm text-white/75"><p>Cartão {index+1} de {order.length}</p><p role="status" aria-live="polite">{reviewed.length} de {order.length} revisados{busy?' · Salvando…':''}</p></div>
  {loading&&<p role="status">Carregando revisões salvas…</p>}
  {error&&<div role="alert" className="space-y-3 rounded-xl bg-red-400/10 p-4 text-sm text-red-100"><p>{error} A revisão não foi confirmada.</p><button type="button" disabled={busy} className="btn-secondary" onClick={()=>{if(back)void record();else {setLoading(true);setRetry(v=>v+1);}}}>Tentar novamente</button></div>}
  <div className="rounded-3xl border border-brand-ice/30 bg-background p-4 shadow-[0_0_30px_#00d8ff12] md:p-7">
   <p className="mb-4 text-xs font-bold uppercase tracking-widest text-brand-ice">{back?'Verso · Compreender':'Frente · Relembrar'} · {saved?'✓ Revisado':'Ainda não revisado'}</p>
   <div key={`${card.id}-${back}`} className="flashcard-face space-y-5 break-words text-sm leading-7 text-white/80" aria-label={back?'Verso do cartão':'Frente do cartão'}>
    <h3 className="text-xl font-bold text-white md:text-2xl">{card.front.title}</h3>
    {back?<>
     <p className="font-bold text-brand-lavender">{card.back.summary}</p><p className="whitespace-pre-wrap">{card.back.explanation}</p>
     <div><h4 className="font-bold text-white">Na prática</h4><p className="whitespace-pre-wrap">{card.back.impact}</p></div>
     {card.back.curiosity&&<div className="rounded-xl border border-brand-purple/40 p-4"><h4 className="font-bold text-white">Você sabia?</h4><p className="whitespace-pre-wrap">{card.back.curiosity}</p></div>}
     {card.back.image&&<CardImage key={card.back.image.resourceUrl} image={card.back.image}/>}
    </>:<><p className="text-base text-white">{card.front.question}</p>{card.front.image&&<CardImage key={card.front.image.resourceUrl} image={card.front.image}/>}</>}
   </div>
   <button type="button" disabled={locked} aria-pressed={back} onClick={flip} className="btn-primary mt-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">{back?'Ver pergunta':'Ver explicação'}</button>
  </div>
  <div className="flex flex-wrap gap-3"><button type="button" className="btn-secondary" disabled={locked||index===0} onClick={()=>move(index-1)}>Cartão anterior</button><button type="button" className="btn-secondary" disabled={locked||index===order.length-1} onClick={()=>move(index+1)}>Próximo cartão</button><button type="button" className="btn-secondary" disabled={locked} onClick={()=>{setOrder(shuffleCards(order));move(0);}}>Embaralhar cartões</button><button type="button" className="btn-secondary" disabled={locked} onClick={()=>move(0)}>Reiniciar sessão</button></div>
  <p className="text-xs text-white/55">Reiniciar ou embaralhar mantém os cartões revisados e seu histórico de conclusão.</p>
  {(completed||(preview&&reviewed.length===order.length))&&<div role="status" className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-5 text-emerald-100"><h3 className="font-bold">{preview?'Todos os cartões revisados nesta prévia':'Cartões concluídos!'}</h3><p className="mt-2 text-sm">Você pode continuar revendo os conceitos quando quiser.</p></div>}
 </section>;
}
