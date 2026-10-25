import type {ReactNode} from 'react';

export const pedagogyField='w-full min-w-0 rounded-xl border border-white/15 bg-background px-3 py-2.5 text-sm text-white focus:border-brand-lavender focus:outline-none focus:ring-2 focus:ring-brand-lavender/30';

export function PedagogyState({loading,error,onRetry,children}:{loading:boolean;error:string;onRetry:()=>void;children?:ReactNode}) {
 if(loading)return <p role="status" className="rounded-2xl bg-surface p-6 text-white/70">Carregando acompanhamento…</p>;
 if(error)return <div role="alert" className="space-y-3 rounded-2xl border border-rose-300/25 bg-surface p-6 text-rose-100"><p>{error}</p><button type="button" onClick={onRetry} className="btn-secondary">Tentar novamente</button></div>;
 return children;
}
export function PedagogyProgress({value,label}:{value:number;label:string}) {
 return <div className="min-w-0 space-y-2"><div className="flex justify-between gap-2 text-xs text-white/65"><span>{label}</span><span className="font-bold text-brand-ice">{value}%</span></div><div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-magenta" style={{width:`${value}%`}}/></div></div>;
}
export function PedagogyBadge({children,complete=false}:{children:ReactNode;complete?:boolean}) {
 return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${complete?'bg-emerald-300/10 text-emerald-200':'bg-brand-purple/15 text-brand-lavender'}`}>{children}</span>;
}
export function PedagogyPagination({page,total,size,onPage,label='Resultados'}:{page:number;total:number;size:number;onPage:(page:number)=>void;label?:string}) {
 const pages=Math.max(1,Math.ceil(total/size));
 return <nav aria-label={`Paginação: ${label}`} className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-sm text-white/65"><p>{total} {label.toLocaleLowerCase('pt-BR')} · Página {page} de {pages}</p><div className="flex gap-2"><button type="button" className="btn-secondary disabled:opacity-40" disabled={page<=1} onClick={()=>onPage(page-1)}>Página anterior</button><button type="button" className="btn-secondary disabled:opacity-40" disabled={page>=pages} onClick={()=>onPage(page+1)}>Próxima página</button></div></nav>;
}
