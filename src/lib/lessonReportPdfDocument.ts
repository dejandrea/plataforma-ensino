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
export async function createLessonReportPdf(data: LessonReportParams, assets: ReportAssets): Promise<Uint8Array> {
  const doc = await PDFDocument.create(); doc.registerFontkit(fontkit);
  const [body, heading, logo] = await Promise.all([
    doc.embedFont(assets.bodyFont, {subset: false}), doc.embedFont(assets.headingFont, {subset: true}), doc.embedPng(assets.logo),
  ]);
  doc.setTitle(`Relatório de aulas realizadas - ${data.studentName}`); doc.setAuthor('Bitaria');
  doc.setSubject(data.periodLabel); doc.setLanguage('pt-BR');
  let page: PDFPage; let y = 0; let rowsOnPage = 0;
  const ink = color(C.ink), lineColor = color('#D8D1DF'), soft = color('#F5F0F8');
  function text(value: string, x: number, top: number, size = 10, font = body) {
    page.drawText(value, {x, y: H - top - size, size, font, color: ink});
  }
  function line(top: number) {page.drawLine({start: {x: M, y: H-top}, end: {x: W-M, y: H-top}, thickness: .5, color: lineColor});}
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
    // A small ink-saving brand bar; all text remains dark on white paper.
    page.drawRectangle({x:M,y:H-31,width:CONTENT,height:2,color:color('#A64FCC')});
    if (first) {
      const ratio=logo.width/logo.height; page.drawImage(logo,{x:M,y:H-73,width:148,height:148/ratio});
      text('Relatório de aulas realizadas',M+170,43,16,heading);
      y=86; y=paragraph(`Aluno: ${data.studentName}`,y,CONTENT,11,heading)+2;
      y=paragraph(`Período: ${data.periodLabel}`,y,CONTENT,10)+10;
    } else {
      text('Relatório de aulas realizadas · continuação',M,42,12,heading);
      y=64; y=paragraph(`${data.studentName} | ${data.periodLabel}`,y,CONTENT,9)+10;
    }
  }
  newPage(true); tableHeader();
  const lessons=data.lessons.map((lesson,index)=>({lesson,index})).sort((a,b)=>Date.parse(b.lesson.starts_at)-Date.parse(a.lesson.starts_at)||a.index-b.index);
  if (!lessons.length) {text('Nenhuma aula registrada neste período.',M+7,y+8); y+=35;}
  for (const {lesson} of lessons) {
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
  if(y+155>BOTTOM)newPage();
  y+=14; text('RESUMO DO PERÍODO',M,y,11,heading); y+=24;
  const metrics=[
    ['Aulas no período',number(data.totalLessons)],['Carga horária',`${number(data.totalHours)}h`],
    ['Hora/aula',data.hourlyRate==null?'Não definido':money(data.hourlyRate)],
    ['Valor bruto',data.grossAmount==null?'Não informado':money(data.grossAmount)],
    ['Descontos',data.discountAmount==null?'Não informado':money(data.discountAmount)],
    ['Total final',data.hourlyRate==null?'A definir':money(data.totalAmount)],
  ];
  const cellWidth=(CONTENT-20)/2;
  for(let i=0;i<metrics.length;i+=2){
    const values=metrics.slice(i,i+2).map(([label,value],j)=>({label,lines:wrap(value,heading,11,cellWidth-12),x:M+j*(cellWidth+20)}));
    const height=20+Math.max(...values.map(v=>v.lines.length))*14;
    if(y+height>BOTTOM)newPage();
    for(const value of values){
      text(value.label.toUpperCase(),value.x,y,8.5);
      value.lines.forEach((item,k)=>text(item,value.x+cellWidth-heading.widthOfTextAtSize(item,11),y+14+k*14,11,heading));
    }
    y+=height;line(y);y+=5;
  }
  doc.getPages().forEach((p,index)=>{
    page=p;line(H-43);text('Bitaria · Aprenda. Crie. Evolua.',M,H-31,8.5);
    const count=`${index+1} / ${doc.getPageCount()}`;text(count,W-M-body.widthOfTextAtSize(count,9),H-31,9);
  });
  return doc.save();
}
