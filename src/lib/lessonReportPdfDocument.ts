import { PDFDocument, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export type LessonReportParams = {
  studentName: string; periodLabel: string; hourlyRate: number | null;
  totalLessons: number; totalHours: number; totalAmount: number;
  grossAmount?: number; discountAmount?: number;
  lessons: { title: string; session_track: string; starts_at: string; ends_at: string }[];
};
export type ReportAssets = { bodyFont: Uint8Array; headingFont: Uint8Array; logo: Uint8Array; mascot?: Uint8Array };
// Bitaria Design System v1.0, on white paper for legibility and printing.
const C = { ink: '#201936', pink: '#E956C9', muted: '#C8BCD8', white: '#F7F4FC' };
const color = (hex: string) => rgb(...[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]);
const W = 595.28, H = 841.89, M = 36, CONTENT = W - M * 2, BOTTOM = 780;
const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const number = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
function wrap(value: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = []; let line = '';
  const words = value.replace(/\s+/g, ' ').trim().split(' ');
  for (const word of words) {
    if (font.widthOfTextAtSize(line + (line ? ' ' : '') + word, size) <= width) { line += (line ? ' ' : '') + word; continue; }
    if (line) { lines.push(line); line = ''; }
    for (const letter of Array.from(word)) {
      if (font.widthOfTextAtSize(line + letter, size) > width && line) { lines.push(line); line = ''; }
      line += letter;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

/** Presentation only: financial totals come unchanged from the existing billing flow. */
export async function createLessonReportPdf(data: LessonReportParams, assets: ReportAssets, layout: 'cards' | 'table' = 'cards'): Promise<Uint8Array> {
  const doc = await PDFDocument.create(); doc.registerFontkit(fontkit);
  const [body, heading, logo] = await Promise.all([
    doc.embedFont(assets.bodyFont, {subset: false}), doc.embedFont(assets.headingFont, {subset: true}), doc.embedPng(assets.logo),
  ]);
  const mascot = assets.mascot ? await doc.embedPng(assets.mascot) : null;
  // Exceptional descriptions use full-width, paginated rows rather than squeezing two columns.
  if(data.lessons.some(lesson=>wrap(lesson.title,body,10,(CONTENT-12)/2-24).length>3))layout='table';
  doc.setTitle(`Relatório de aulas realizadas - ${data.studentName}`); doc.setAuthor('Bitaria');
  doc.setSubject(data.periodLabel); doc.setLanguage('pt-BR');
  let page!: PDFPage; let y = 0; let rowsOnPage = 0;
  const ink = color(C.ink), lineColor = color('#D8D1DF'), soft = color('#F5F0F8');
  function text(value: string, x: number, top: number, size = 10, font = body) {
    page.drawText(value, {x, y: H - top - size, size, font, color: ink});
  }
  function line(top: number) {page.drawLine({start: {x: M, y: H-top}, end: {x: W-M, y: H-top}, thickness: .5, color: lineColor});}
  function box(x:number,top:number,width:number,height:number,r=8) {
    page.drawSvgPath(`M ${r} 0 H ${width-r} Q ${width} 0 ${width} ${r} V ${height-r} Q ${width} ${height} ${width-r} ${height} H ${r} Q 0 ${height} 0 ${height-r} V ${r} Q 0 0 ${r} 0 Z`,{x,y:H-top,color:ink});
  }
  function paragraph(value: string, top: number, width = CONTENT, size = 10, font = body) {
    const lines = wrap(value, font, size, width);
    for (const item of lines) {if (top + size + 4 > BOTTOM) {newPage(); top = y;} text(item, M, top, size, font); top += size+4;}
    return top;
  }
  function tableHeader() {
    page.drawRectangle({x:M,y:H-y-24,width:CONTENT,height:24,color:soft});
    text('DATA / HORA',M+7,y+6,8.5,heading); text('DURAÇÃO',M+97,y+6,8.5,heading);
    text('ASSUNTO / MODALIDADE',M+156,y+6,8.5,heading); text('SITUAÇÃO',W-M-68,y+6,8.5,heading);
    y += 28;
  }
  function newPage(first = false) {
    page = doc.addPage([W,H]); rowsOnPage = 0;
    page.drawRectangle({x:0,y:H-88,width:W,height:88,color:ink});
    page.drawRectangle({x:0,y:H-91,width:W,height:3,color:color(C.pink)});
    const ratio=logo.width/logo.height;
    page.drawImage(logo,{x:M,y:H-65,width:160,height:160/ratio});
    page.drawText('Aprenda. Crie. Evolua.',{x:M+186,y:H-54,size:11,font:body,color:color(C.white)});
    if (first) {
      text('Relatório de aulas realizadas',M,108,19,heading);
      y=140; y=paragraph(`Aluno: ${data.studentName}`,y,CONTENT-65,11,heading)+2;
      y=paragraph(`Período: ${data.periodLabel}`,y,CONTENT-65,10)+2;
      const tracks=[...new Set(data.lessons.map(l=>l.session_track==='course'?'Curso completo':'Mentoria'))];
      y=paragraph(`Modalidade: ${tracks.join(' e ') || 'Não informada'}`,y,CONTENT-65,9)+12;
      if(mascot)page.drawImage(mascot,{x:W-M-60,y:H-192,width:58,height:58});
    } else {
      text('Relatório de aulas realizadas · continuação',M,108,12,heading);
      y=132; y=paragraph(`${data.studentName} | ${data.periodLabel}`,y,CONTENT,9)+10;
    }
  }
  newPage(true); if(layout==='table')tableHeader();
  const lessons=data.lessons.map((lesson,index)=>({lesson,index})).sort((a,b)=>Date.parse(b.lesson.starts_at)-Date.parse(a.lesson.starts_at)||a.index-b.index);
  if (!lessons.length) {text('Nenhuma aula registrada neste período.',M+7,y+8); y+=35;}
  if(layout==='cards') {
    const width=(CONTENT-12)/2, lineHeight=13;
    for(let start=0;start<lessons.length;start+=10) {
      if(start)newPage();
      const group=lessons.slice(start,start+10), split=Math.ceil(group.length/2);
      const columnHeight=(items:typeof group)=>items.reduce((sum,{lesson})=>sum+55+wrap(lesson.title,body,10,width-24).length*lineHeight,0);
      if(y+Math.max(columnHeight(group.slice(0,split)),columnHeight(group.slice(split)))>BOTTOM)newPage();
      const top=y;let bottom=top;
      for(let column=0;column<2;column++) {
        y=top;
        for(const {lesson} of group.slice(column*split,(column+1)*split)) {
          const date=new Date(lesson.starts_at), end=new Date(lesson.ends_at);
          const valid=Number.isFinite(date.getTime())&&Number.isFinite(end.getTime());
          const stamp=valid?date.toLocaleDateString('pt-BR',{timeZone:'America/Bahia'})+' · '+date.toLocaleTimeString('pt-BR',{timeZone:'America/Bahia',hour:'2-digit',minute:'2-digit'}):'Data não registrada';
          const track=lesson.session_track==='course'?'Curso completo':'Mentoria';
          const detail=`${track} · ${valid?number((end.getTime()-date.getTime())/3600000)+'h':'—'} · Realizada`;
          const lines=wrap(lesson.title,body,10,width-24);let offset=0;
          while(offset<lines.length) {
            const desired=47+(lines.length-offset)*lineHeight;
            if(y+Math.min(desired,590)>BOTTOM && y>top) {newPage();bottom=y;}
            const capacity=Math.max(1,Math.floor((BOTTOM-y-47)/lineHeight));
            const chunk=lines.slice(offset,offset+capacity), height=47+chunk.length*lineHeight;
            const x=M+column*(width+12);
            box(x,y,width,height);
            page.drawRectangle({x,y:H-y-height,width:3,height,color:color(C.pink)});
            const light=(value:string,top:number,size:number,font=body)=>page.drawText(value,{x:x+12,y:H-top-size,size,font,color:color(C.white)});
            light(stamp+(offset?' · cont.':''),y+8,9,heading);
            light(detail,y+23,8);
            chunk.forEach((line,i)=>light(line,y+39+i*lineHeight,10));
            y+=height+8;offset+=chunk.length;
            if(offset<lines.length){newPage();bottom=y;}
          }
          bottom=Math.max(bottom,y);
        }
      }
      y=bottom;
    }
  } else for (const {lesson} of lessons) {
    const start=new Date(lesson.starts_at),end=new Date(lesson.ends_at);
    const valid=Number.isFinite(start.getTime())&&Number.isFinite(end.getTime());
    const day=valid?start.toLocaleDateString('pt-BR',{timeZone:'America/Bahia'}):'Não registrada';
    const time=valid?start.toLocaleTimeString('pt-BR',{timeZone:'America/Bahia',hour:'2-digit',minute:'2-digit'}):'';
    const duration=valid?`${number((end.getTime()-start.getTime())/3600000)}h`:'—';
    const title=wrap(lesson.title,body,10,CONTENT-241);
    const track=lesson.session_track==='course'?'Curso completo':'Mentoria';
    let offset=0;
    while(offset<title.length) {
      const remaining=title.length-offset;
      const wholeHeight=Math.max(39,remaining*13+22);
      if (rowsOnPage>=10 || (wholeHeight<=BOTTOM-140 && y+wholeHeight>BOTTOM) || y+48>BOTTOM) {newPage();tableHeader();}
      const capacity=Math.max(1,Math.floor((BOTTOM-y-22)/13));
      const chunk=title.slice(offset,offset+capacity);
      const height=Math.max(39,chunk.length*13+22);
      text(day,M+7,y+5,9); text(time,M+7,y+18,9);
      text(duration,M+97,y+5,10);
      chunk.forEach((item,i)=>text(item,M+156,y+5+i*13,10));
      text(track+(offset?' · continuação':''),M+156,y+height-13,8.5);
      text('Realizada',W-M-68,y+5,9);
      y+=height; line(y); offset+=chunk.length; rowsOnPage++;
    }
  }
  // Reserve the complete financial summary. No calculations or discount rules are changed here.
  if(y+163>BOTTOM)newPage();
  y+=14; text('RESUMO DO PERÍODO',M,y,11,heading); y+=24;
  const metrics=[
    ['Aulas no período',number(data.totalLessons)],['Carga horária',`${number(data.totalHours)}h`],
    ['Hora/aula',data.hourlyRate==null?'Não definido':money(data.hourlyRate)],
    ['Valor bruto',data.grossAmount==null?'Não informado':money(data.grossAmount)],
    ['Descontos',data.discountAmount==null?'Não informado':money(data.discountAmount)],
  ];
  const cellWidth=(CONTENT-24)/5;
  const values=metrics.map(([label,value],j)=>({label,lines:wrap(value,heading,11,cellWidth-12),x:M+j*(cellWidth+6)}));
  const height=29+Math.max(...values.map(v=>v.lines.length))*14;
  if(y+height+62>BOTTOM)newPage();
  for(const value of values){
    box(value.x,y,cellWidth,height);
    page.drawText(value.label.toUpperCase(),{x:value.x+6,y:H-y-14,size:8,font:body,color:color(C.muted)});
    value.lines.forEach((item,k)=>page.drawText(item,{x:value.x+6,y:H-y-33-k*14,size:11,font:heading,color:color(C.white)}));
  }
  y+=height+8;
  box(M,y,CONTENT,45);
  page.drawRectangle({x:M,y:H-y-45,width:3,height:45,color:color(C.pink)});
  page.drawText('TOTAL FINAL',{x:M+12,y:H-y-28,size:10,font:heading,color:color(C.white)});
  const total=data.hourlyRate==null?'A definir':money(data.totalAmount);
  page.drawText(total,{x:W-M-14-heading.widthOfTextAtSize(total,20),y:H-y-30,size:20,font:heading,color:color(C.white)});
  doc.getPages().forEach((p,index)=>{
    page=p;line(H-43);text('Bitaria · Aprenda. Crie. Evolua.',M,H-31,8.5);
    const count=`${index+1} / ${doc.getPageCount()}`;text(count,W-M-body.widthOfTextAtSize(count,9),H-31,9);
  });
  return doc.save();
}
