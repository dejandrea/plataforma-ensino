export type TimeRange = {start: string; end: string};
export type WeeklyAvailability = Record<string, TimeRange[]>;
export const weekDays = [
  {id:1,label:'Segunda-feira'}, {id:2,label:'Terça-feira'}, {id:3,label:'Quarta-feira'},
  {id:4,label:'Quinta-feira'}, {id:5,label:'Sexta-feira'}, {id:6,label:'Sábado'}, {id:7,label:'Domingo'},
];
export function timeMinutes(value: string): number {
  if(typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw new Error('Informe horários válidos no formato HH:mm.');
  return Number(value.slice(0,2))*60+Number(value.slice(3));
}
export function legacyWeeklyAvailability(days: number[], start: string, end: string): WeeklyAvailability {
  return Object.fromEntries(weekDays.map(({id})=>[String(id),days.includes(id)?[{start,end}]:[]]));
}
export function readWeeklyAvailability(value: unknown, days: number[], start: string, end: string): WeeklyAvailability {
  if(value==null)return legacyWeeklyAvailability(days,start,end);
  if(typeof value!=='object'||Array.isArray(value))throw new Error('A disponibilidade semanal deve conter os dias e suas faixas.');
  const entries=Object.entries(value);
  if(entries.some(([key,ranges])=>!weekDays.some(d=>String(d.id)===key)||!Array.isArray(ranges)||ranges.length>24||ranges.some(r=>!r||typeof r!=='object'||typeof r.start!=='string'||typeof r.end!=='string')))
    throw new Error('A disponibilidade semanal contém dias ou faixas inválidas.');
  return Object.fromEntries(weekDays.map(({id})=>[String(id),((value as WeeklyAvailability)[id]||[]).map(({start,end})=>({start,end}))]));
}
/** Minutes relative to the selected weekday. Overnight windows remain backward compatible. */
export function availabilityIntervals(schedule: WeeklyAvailability, start: string, end: string, slotMinutes: number) {
  const lower=timeMinutes(start);let upper=timeMinutes(end);if(upper<=lower)upper+=1440;
  if(!Number.isInteger(slotMinutes)||slotMinutes<15||slotMinutes>1440)throw new Error('A duração deve ser um número inteiro entre 15 e 1440 minutos.');
  const result: Record<string, {start:number;end:number}[]>={};
  for(const {id,label} of weekDays) {
    const intervals=(schedule[id]||[]).map(range=>{
      let begin=timeMinutes(range.start),finish=timeMinutes(range.end);
      if(upper>1440&&begin<lower)begin+=1440;
      if(finish<=begin%1440)finish+=1440;
      if(begin>=1440&&finish<begin)finish+=1440;
      if(begin<lower||finish>upper||finish-begin<slotMinutes)throw new Error(`${label}: cada faixa deve ficar dentro da janela de atendimento e comportar uma aula de ${slotMinutes} minutos.`);
      return {start:begin,end:finish};
    }).sort((a,b)=>a.start-b.start);
    if(intervals.some((r,i)=>i>0&&r.start<intervals[i-1].end))throw new Error(`${label}: existem faixas sobrepostas. Ajuste os horários.`);
    result[id]=intervals;
  }
  return result;
}
