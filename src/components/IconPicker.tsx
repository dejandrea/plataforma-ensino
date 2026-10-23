import {useId,useState,useRef} from 'react';
import {supabase} from '../lib/supabaseClient';
import {CatalogIcon} from './CatalogIcon';
const icons=['🏅','🏆','⭐','💻','🚀','🧠','🔥','🎯','🛠️','🌐','📚','💡','🤝','🎨','🥉','🥈','🥇','⚙️'];
export function IconPicker({value,onChange,label='Ícone',disabled=false,onBusyChange}:{value:string;onChange:(value:string)=>void;label?:string;disabled?:boolean;onBusyChange?:(busy:boolean)=>void}) {
 const id=useId();
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const fileInput=useRef<HTMLInputElement>(null);
 const upload=async(file?:File)=>{
  if(!file)return;setError('');
  const formats:Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
  const extension=file.name.split('.').at(-1)?.toLowerCase();
  const contentType=file.type||({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'} as Record<string,string>)[extension||''];
  if(!formats[contentType]||file.size>2*1024*1024){setError('Escolha PNG, JPEG ou WebP de até 2 MB.');if(fileInput.current)fileInput.current.value='';return;}
  setBusy(true);onBusyChange?.(true);
  try {
   const {data:{user},error:authError}=await supabase.auth.getUser();if(authError||!user)throw new Error('Entre novamente para enviar o ícone.');
   const path=`${user.id}/${crypto.randomUUID()}.${formats[contentType]}`;
   const {error:uploadError}=await supabase.storage.from('catalog-icons').upload(path,file,{contentType,upsert:false});if(uploadError)throw uploadError;
   const {data}=supabase.storage.from('catalog-icons').getPublicUrl(path);onChange(data.publicUrl);
  } catch(e) {
   const message=e instanceof Error?e.message:String((e as {message?:string})?.message||'');
   setError(/bucket.*not found/i.test(message)?'O armazenamento de ícones ainda não foi configurado neste ambiente. Solicite a ativação do bucket catalog-icons.':/row.level|unauthorized|permission|not authorized/i.test(message)?'Seu acesso não permite enviar ícones. Entre com uma conta de administrador ativa.':/Entre novamente/.test(message)?message:'Não foi possível enviar a imagem. Tente novamente.');
  }
  finally {setBusy(false);onBusyChange?.(false);if(fileInput.current)fileInput.current.value='';}
 };
 let image=false;try{image=new URL(value).protocol==='https:';}catch{/* Existing emoji. */}
 const invalidUrl=/^[a-z][a-z\d+.-]*:/i.test(value)&&!image;
 return <fieldset disabled={disabled||busy} className="space-y-3"><legend className="text-sm font-semibold text-white">{label}</legend><div className="flex flex-wrap gap-2">{icons.map(icon=><button type="button" key={icon} aria-label={`Usar ícone ${icon}`} aria-pressed={value===icon} className={`rounded-lg p-2 text-xl ring-1 ${value===icon?'bg-brand-magenta ring-brand-pink':'ring-white/20'}`} onClick={()=>onChange(icon)}>{icon}</button>)}</div><label htmlFor={id} className="text-sm text-white/70">Ícone personalizado ou link HTTPS</label><input id={id} value={value} maxLength={2048} onChange={e=>onChange(e.target.value)} onInvalid={e=>e.currentTarget.setCustomValidity('Use um emoji ou um link HTTPS válido.')} onInput={e=>e.currentTarget.setCustomValidity('')} pattern={invalidUrl?'(?!)':undefined} className="input w-full"/>
 <label htmlFor={`${id}-file`} className="block text-sm text-white/70">Carregar imagem do ícone</label><input ref={fileInput} id={`${id}-file`} type="file" accept="image/png,image/jpeg,image/webp" className="block w-full min-w-0 text-sm text-white/70" onChange={e=>void upload(e.target.files?.[0])}/><p className="text-xs text-white/55">PNG, JPEG ou WebP, até 2 MB. Depois, salve o cadastro para confirmar a alteração.</p>
 {busy&&<p role="status">Enviando imagem…</p>}{(error||invalidUrl)&&<p role="alert">{error||'Use um emoji ou um link HTTPS válido.'}</p>}<p className="text-white">Prévia: <span aria-label="Prévia do ícone" className="text-2xl"><CatalogIcon value={value||'—'}/></span></p></fieldset>;
}
