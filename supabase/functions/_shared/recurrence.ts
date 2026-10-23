const parts=(date:Date,zone:string)=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
const utcValue=(p:Record<string,number>)=>Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);
function zonedInstant(p:Record<string,number>,zone:string) {
 const desired=utcValue(p);let value=desired;
 for(let n=0;n<4;n++) {const difference=desired-utcValue(parts(new Date(value),zone));if(!difference) return new Date(value).toISOString();value+=difference;}
 throw new Error('Este horário não existe no fuso selecionado. Escolha outro horário.');
}
export function shiftZonedWeeks(value:string,weeks:number,zone='America/Bahia') {
 const p=parts(new Date(value),zone),date=new Date(Date.UTC(p.year,p.month-1,p.day+weeks*7));
 return zonedInstant({...p,year:date.getUTCFullYear(),month:date.getUTCMonth()+1,day:date.getUTCDate()},zone);
}
export function planRecurrence(startsAt:string,count:number,weekdays?:number[],zone='America/Bahia',until?:string) {
 const start=new Date(startsAt);
 if(!Number.isFinite(start.getTime())||!Number.isInteger(count)||count<1||count>104) throw new Error('Informe data válida e entre 1 e 104 encontros.');
 const p=parts(start,zone),base=new Date(Date.UTC(p.year,p.month-1,p.day));
 const days=weekdays?.length?[...new Set(weekdays)]:[base.getUTCDay()];
 if(days.some(d=>!Number.isInteger(d)||d<0||d>6)) throw new Error('Dias da semana inválidos.');
 if(until&&!/^\d{4}-\d{2}-\d{2}$/.test(until)) throw new Error('Data final inválida.');
 const result:string[]=[];
 for(let offset=0;offset<740&&result.length<count;offset++) {
  const date=new Date(base.getTime()+offset*86400000),day=date.toISOString().slice(0,10);
  if(until&&day>until) break;
  if(days.includes(date.getUTCDay())) result.push(zonedInstant({...p,year:date.getUTCFullYear(),month:date.getUTCMonth()+1,day:date.getUTCDate()},zone));
 }
 if(!result.length) throw new Error('Nenhum encontro cabe no período selecionado.');
 return result;
}
