import {useEffect,useRef,useState} from 'react';
import type {PresentationBundle} from '../../types/presentations';

export function PresentationFrame({bundle,title='Prévia da apresentação'}:{bundle:PresentationBundle;title?:string}){
  const frame=useRef<HTMLIFrameElement>(null);
  const [nonce]=useState(()=>crypto.randomUUID());
  const [height,setHeight]=useState(750);
  useEffect(()=>{
    const send=()=>frame.current?.contentWindow?.postMessage({type:'bitara-presentation-data',nonce,...bundle},window.location.origin);
    const receive=(event:MessageEvent)=>{
      if(event.origin!==window.location.origin||event.source!==frame.current?.contentWindow||event.data?.nonce!==nonce)return;
      if(event.data.type==='bitara-presentation-ready')send();
      if(event.data.type==='bitara-presentation-height'&&Number.isFinite(event.data.height))setHeight(Math.max(500,Math.min(12000,event.data.height)));
    };
    window.addEventListener('message',receive);send();
    return ()=>window.removeEventListener('message',receive);
  },[nonce,bundle]);
  return <iframe ref={frame} src={`/apresentacoes/index.html?embedded=${nonce}`} title={title} allow="fullscreen" referrerPolicy="same-origin" className="w-full rounded-2xl border border-white/10" style={{height}} />;
}
