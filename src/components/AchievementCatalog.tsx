import {CatalogIcon} from './CatalogIcon';
import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabaseClient';
import {IconPicker} from './IconPicker';
type Badge={code:string;title:string;description:string;icon:string};
export function AchievementCatalog({masteries=false}:{masteries?:boolean}) {
 const [items,setItems]=useState<Badge[]>([]),[draft,setDraft]=useState<Badge|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
 useEffect(()=>{let active=true;void supabase.from('achievement_definitions').select('code,title,description,icon').order('title').then(({data,error})=>{if(active){if(error)setMessage('Não foi possível carregar as conquistas.');else setItems((data||[]).filter(row=>row.code.startsWith('mastery:')===masteries));}});return()=>{active=false;};},[masteries,refresh]);
 const [uploading,setUploading]=useState(false);
 const save=async()=>{
  if(!draft||busy||uploading||!draft.title.trim()||!draft.icon.trim())return;setBusy(true);
  const {error}=await supabase.from('achievement_definitions').update({title:draft.title.trim(),description:draft.description,icon:draft.icon}).eq('code',draft.code).select('code').single();
  setBusy(false);setMessage(error?'Não foi possível salvar.':'Conquista atualizada.');if(!error){setDraft(null);setRefresh(v=>v+1);window.dispatchEvent(new Event('gamification-updated'));}
 };
 return <section className="mt-6 space-y-4 text-white"><h2 className="text-2xl font-bold">{masteries?'Medalhas de maestria':'Conquistas oficiais e existentes'}</h2><p>Os critérios oficiais são controlados pelo sistema. A manutenção preserva os códigos, vínculos e desbloqueios.</p>{message&&<p role="status">{message}</p>}{draft&&<form onSubmit={e=>{e.preventDefault();void save();}} className="space-y-4 rounded-2xl bg-surface p-5"><label className="block">Nome<input required maxLength={180} className="input w-full" value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label><label className="block">Descrição<textarea className="input w-full" value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label><IconPicker disabled={busy||uploading} onBusyChange={setUploading} value={draft.icon} onChange={icon=>setDraft({...draft,icon})}/><button disabled={busy||uploading} className="btn-primary">Salvar conquista</button><button type="button" className="btn-secondary ml-3" onClick={()=>setDraft(null)}>Cancelar</button></form>}<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map(item=><article key={item.code} className="space-y-3 rounded-2xl bg-surface p-5"><h3 className="font-bold"><CatalogIcon value={item.icon}/> {item.title}</h3><p className="text-sm text-white/65">{item.description}</p><button className="btn-secondary" onClick={()=>setDraft(item)}>Editar {item.title}</button></article>)}</div></section>;
}
