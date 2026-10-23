import {useState} from 'react';

export function CatalogIcon({value}:{value:string}) {
 const [failed,setFailed]=useState('');
 let image=false;try{image=new URL(value).protocol==='https:';}catch{/* Existing emoji. */}
 return image ? failed===value ? <span aria-label="Imagem indisponível">🏅</span> : <img src={value} alt="" loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(value)} className="inline-block h-8 w-8 shrink-0 object-contain align-middle"/> : <span>{value}</span>;
}
