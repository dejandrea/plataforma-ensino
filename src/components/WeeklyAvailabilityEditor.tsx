import {useState} from 'react';
import {weekDays, timeMinutes, availabilityIntervals, type WeeklyAvailability} from '../../supabase/functions/_shared/weekly-availability';

export function WeeklyAvailabilityEditor({value,onChange,start,end,slotMinutes}: {
  value:WeeklyAvailability;onChange:(value:WeeklyAvailability)=>void;start:string;end:string;slotMinutes:number;
}) {
  const [copyDay,setCopyDay]=useState<number|null>(null),[targets,setTargets]=useState<number[]>([]);
  const [notice,setNotice]=useState('');
  let error='';try {availabilityIntervals(value,start,end,slotMinutes);}catch(e){error=(e as Error).message;}
  function update(day:number,ranges:WeeklyAvailability[string]) {onChange({...value,[day]:ranges});setNotice('');}
  function add(day:number) {
    const ranges=value[day]||[];
    let from=start,to=end;
    if(ranges.length) {
      try {
        const lower=timeMinutes(start),upper=timeMinutes(end)+(timeMinutes(end)<=lower?1440:0);
        const intervals=availabilityIntervals({[day]:ranges},start,end,slotMinutes)[day];
        let cursor=lower;
        for(const interval of [...intervals,{start:upper,end:upper}]) {
          if(interval.start-cursor>=slotMinutes){from=clock(cursor);to=clock(cursor+slotMinutes);break;}
          cursor=interval.end;
        }
        if(from===start&&to===end){setNotice('Não há espaço livre nesta janela para outra faixa. Ajuste os intervalos existentes.');return;}
      }catch {setNotice('Corrija as faixas deste dia antes de adicionar outra.');return;}
    }
    update(day,[...ranges,{start:from,end:to}]);
  }
  const clock=(minutes:number)=>`${String(Math.floor(minutes/60)%24).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
  return <section aria-label="Horários por dia da semana" className="mt-5 space-y-3">
    <div><h3 className="text-sm font-bold text-white">Disponibilidade semanal</h3><p className="mt-1 text-sm text-white/60">Defina uma ou mais faixas por dia, dentro da janela de atendimento. Dias sem faixas ficam indisponíveis.</p></div>
    {weekDays.map(({id,label})=><div key={id} className="rounded-2xl bg-brand-900/40 p-3 ring-1 ring-white/10 sm:flex sm:gap-4">
      <div className="mb-3 flex items-center justify-between gap-2 sm:mb-0 sm:w-32 sm:shrink-0 sm:flex-col sm:items-start sm:justify-start">
        <span className="text-sm font-bold text-white">{label}</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={(value[id]||[]).length>=24} className="text-xs text-brand-lavender underline disabled:opacity-50" onClick={()=>add(id)} aria-label={`Adicionar faixa em ${label}`}>+ Adicionar</button>
          {(value[id]||[]).length>0&&<button type="button" className="text-xs text-brand-lavender underline" aria-label={`Copiar horários de ${label}`} onClick={()=>{setCopyDay(id);setTargets([]);}}>Copiar</button>}
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {!(value[id]||[]).length&&<p className="py-2 text-sm text-white/45">Indisponível</p>}
        {(value[id]||[]).map((range,index)=><div key={index} className="flex flex-wrap items-center gap-2">
          <input type="time" required aria-label={`${label}: início da faixa ${index+1}`} value={range.start} onChange={e=>update(id,value[id].map((r,i)=>i===index?{...r,start:e.target.value}:r))} className="min-w-0 flex-1 rounded-xl bg-surface p-2 text-white ring-1 ring-white/15 sm:flex-none sm:w-28" />
          <span aria-hidden="true" className="text-white/50">–</span>
          <input type="time" required aria-label={`${label}: fim da faixa ${index+1}`} value={range.end} onChange={e=>update(id,value[id].map((r,i)=>i===index?{...r,end:e.target.value}:r))} className="min-w-0 flex-1 rounded-xl bg-surface p-2 text-white ring-1 ring-white/15 sm:flex-none sm:w-28" />
          <button type="button" aria-label={`Remover faixa ${index+1} de ${label}`} onClick={()=>update(id,value[id].filter((_,i)=>i!==index))} className="rounded-lg px-2 py-2 text-white/70 hover:bg-white/10">×</button>
          {range.end<=range.start&&<span className="text-xs text-white/50">Termina no dia seguinte</span>}
        </div>)}
      </div>
    </div>)}
    {copyDay!==null&&<fieldset className="rounded-xl border border-brand-lavender/40 p-4">
      <legend className="px-2 text-sm font-bold text-white">Copiar {weekDays.find(d=>d.id===copyDay)?.label} para</legend>
      <p className="mb-3 text-xs text-white/60">As faixas dos dias selecionados serão substituídas ao aplicar.</p>
      <div className="flex flex-wrap gap-3">{weekDays.filter(d=>d.id!==copyDay).map(({id,label})=><label key={id} className="flex gap-2 text-sm text-white"><input type="checkbox" checked={targets.includes(id)} onChange={e=>setTargets(e.target.checked?[...targets,id]:targets.filter(t=>t!==id))}/>{label}</label>)}</div>
      <div className="mt-4 flex gap-3"><button type="button" disabled={!targets.length} className="btn-primary" onClick={()=>{const next={...value};for(const target of targets)next[target]=value[copyDay].map(r=>({...r}));onChange(next);setCopyDay(null);setNotice('Horários copiados. Salve a disponibilidade para aplicar.');}}>Aplicar cópia</button><button type="button" className="btn-secondary" onClick={()=>setCopyDay(null)}>Cancelar cópia</button></div>
    </fieldset>}
    {error&&<p role="alert" className="text-sm text-rose-200">{error}</p>}
    {notice&&<p role="status" className="text-sm text-white/70">{notice}</p>}
  </section>;
}
