export const pedagogyCourseLabels={not_started:'Não iniciado',in_progress:'Em andamento',completed:'Concluído',no_course:'Sem curso disponível'};
export const pedagogyProjectLabels={submitted:'Aguardando avaliação',in_review:'Em avaliação',needs_revision:'Ajustes solicitados',approved:'Aprovado'};

export function pedagogyDate(value:string|null|undefined) {
 if(!value)return 'Sem registro';
 return new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Bahia'});
}
export function pedagogyPeriod(from:string,until:string) {
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const parsedEnd=new Date(`${until||today}T00:00:00-03:00`);
 const end=Number.isFinite(parsedEnd.getTime())?parsedEnd:new Date(`${today}T00:00:00-03:00`);
 const parsedStart=from?new Date(`${from}T00:00:00-03:00`):new Date(end.getTime()-29*86400000);
 const start=Number.isFinite(parsedStart.getTime())?parsedStart:new Date(end.getTime()-29*86400000);
 return {p_since:start.toISOString(),p_until:new Date(end.getTime()+86400000).toISOString()};
}
