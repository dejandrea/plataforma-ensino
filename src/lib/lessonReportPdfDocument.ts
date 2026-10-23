import { PDFDocument, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export type LessonReportParams = {
  studentName: string; periodLabel: string; hourlyRate: number | null;
  totalLessons: number; totalHours: number; totalAmount: number;
  grossAmount?: number; discountAmount?: number;
  lessons: { title: string; session_track: string; starts_at: string; ends_at: string }[];
};
export type ReportAssets = { bodyFont: Uint8Array; headingFont: Uint8Array; logo: Uint8Array; mascot: Uint8Array };
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

/** Presentation only: financial totals come from the existing billing flow. */
export async function createLessonReportPdf(data: LessonReportParams, assets: ReportAssets): Promise<Uint8Array> {
  const doc = await PDFDocument.create(); doc.registerFontkit(fontkit);
  const [body, heading, logo, mascot] = await Promise.all([
    doc.embedFont(assets.bodyFont, { subset: false }), doc.embedFont(assets.headingFont, { subset: true }),
    doc.embedPng(assets.logo), doc.embedPng(assets.mascot),
  ]);
  doc.setTitle(`Relatório de aulas realizadas - ${data.studentName}`); doc.setAuthor('Bitaria');
  doc.setSubject(data.periodLabel); doc.setLanguage('pt-BR');
  let page: PDFPage; let y = 0;
  const text = (value: string, x: number, top: number, size = 10, font = body, fill = C.ink) => {
    page.drawText(value, { x, y: H - top - size, size, font, color: color(fill) });
  };
  const rect = (x: number, top: number, width: number, height: number, fill: string, radius = 10) => {
    const r = Math.min(radius, width / 2, height / 2);
    const path = `M ${r} 0 L ${width-r} 0 Q ${width} 0 ${width} ${r} L ${width} ${height-r} Q ${width} ${height} ${width-r} ${height} L ${r} ${height} Q 0 ${height} 0 ${height-r} L 0 ${r} Q 0 0 ${r} 0 Z`;
    page.drawSvgPath(path, { x, y: H - top, color: color(fill) });
  };
  const paragraph = (value: string, x: number, top: number, width: number, size = 10, font = body, fill = C.ink) => {
    const lines = wrap(value, font, size, width);
    lines.forEach((line, i) => text(line, x, top + i * (size + 4), size, font, fill));
    return lines.length * (size + 4);
  };
  function newPage(first = false) {
    page = doc.addPage([W, H]);
    rect(0, 0, W, first ? 88 : 64, C.ink, 0);
    rect(0, first ? 85 : 61, W, 3, C.pink, 0);
    if (first) {
      page.drawImage(logo, { x: (W - 336) / 2, y: H - 84, width: 336, height: 84 });
      y = 108;
      y += paragraph('Relatório de aulas realizadas', M, y, CONTENT - 104, 20, heading) + 6;
      y += paragraph(`Aluno: ${data.studentName}`, M, y, CONTENT - 110, 11) + 3;
      y += paragraph(`Período: ${data.periodLabel}`, M, y, CONTENT - 110, 10) + 4;
      const tracks = new Set(data.lessons.map(l => l.session_track));
      if (tracks.size === 1) y += paragraph(tracks.has('course') ? 'Modalidade: Curso completo' : 'Modalidade: Mentoria', M, y, CONTENT - 110, 9) + 3;
      page.drawImage(mascot, { x: W - M - 96, y: H - 204, width: 84, height: 84 });
      y = Math.max(y + 10, 202);
    } else {
      text('Relatório de aulas realizadas', M, 15, 16, heading, C.white);
      y = 84;
      y += paragraph(`${data.studentName} | ${data.periodLabel}`, M, y, CONTENT, 10) + 12;
    }
  }
  newPage(true);
  text('AULAS REALIZADAS', M, y, 10, heading); y += 23;
  const lessons = data.lessons.map((lesson, index) => ({ lesson, index })).sort((a, b) =>
    Date.parse(b.lesson.starts_at) - Date.parse(a.lesson.starts_at) || a.index - b.index);
  if (!lessons.length) { text('Nenhuma aula registrada neste período.', M, y, 11); y += 35; }
  for (const { lesson } of lessons) {
    const title = wrap(lesson.title, body, 10, CONTENT - 30);
    const track = lesson.session_track === 'course' ? 'Curso completo' : 'Mentoria';
    const start = new Date(lesson.starts_at), end = new Date(lesson.ends_at);
    const valid = Number.isFinite(start.getTime()) && Number.isFinite(end.getTime());
    const when = valid ? `${start.toLocaleDateString('pt-BR')} · ${start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Data não registrada';
    const duration = valid ? `${number((end.getTime() - start.getTime()) / 3_600_000)}h` : 'Não registrada';
    let offset = 0;
    while (offset < title.length) {
      // Normal cards remain whole; exceptionally large titles use explicit continuation cards.
      const chunk = title.slice(offset, offset + 35);
      const height = 35 + chunk.length * 14;
      if (y + height > BOTTOM) newPage();
      rect(M, y, CONTENT, height, C.ink); rect(M, y + 12, 3, height - 24, C.pink, 1);
      text(when + (offset ? ' · continuação' : ''), M + 15, y + 7, 10, heading, C.white);
      chunk.forEach((line, i) => text(line, M + 15, y + 23 + i * 14, 10, body, C.white));
      text(`${track} · Duração: ${duration}`, M + 15, y + height - 12, 8.5, body, C.muted);
      y += height + 7; offset += chunk.length;
    }
  }
  if (y + 157 > BOTTOM) newPage();
  y += 16; text('RESUMO DO PERÍODO', M, y, 11, heading); y += 25;
  const metrics = [
    ['AULAS NO PERÍODO', number(data.totalLessons)], ['CARGA HORÁRIA', `${number(data.totalHours)}h`],
    ['HORA/AULA', data.hourlyRate == null ? 'Não definido' : money(data.hourlyRate)],
    ['VALOR BRUTO', data.grossAmount == null ? 'Não informado' : money(data.grossAmount)],
    ['DESCONTOS', data.discountAmount == null ? 'Não informado' : money(data.discountAmount)],
  ];
  const gap = 8, col = (CONTENT - gap * 4) / 5;
  metrics.forEach(([label, value], i) => {
    const x = M + i * (col + gap), top = y;
    rect(x, top, col, 52, C.ink); text(label, x + 8, top + 9, 6.5, body, C.muted);
    const size = Math.min(14, (col - 16) / Math.max(heading.widthOfTextAtSize(value, 1), 1));
    text(value, x + 8, top + 26, size, heading, C.white);
  });
  y += 62; rect(M, y, CONTENT, 54, C.ink); rect(M, y, 4, 54, C.pink, 0);
  text('TOTAL FINAL', M + 15, y + 19, 11, heading, C.muted);
  const total = data.hourlyRate == null ? 'A definir' : money(data.totalAmount);
  const totalSize = Math.min(23, (CONTENT - 160) / Math.max(heading.widthOfTextAtSize(total, 1), 1));
  text(total, W - M - 15 - heading.widthOfTextAtSize(total, totalSize), y + 13, totalSize, heading, C.white);
  doc.getPages().forEach((p, index) => {
    page = p;
    page.drawLine({ start: { x: M, y: 43 }, end: { x: W - M, y: 43 }, thickness: 0.6, color: color(C.muted) });
    page.drawImage(logo, { x: M - 20, y: 3, width: 144, height: 36 });
    text('Aprenda. Crie. Evolua.', M + 135, H - 28, 8, heading);
    const count = `${index + 1} / ${doc.getPageCount()}`;
    text(count, W - M - body.widthOfTextAtSize(count, 8), H - 32, 8);
  });
  return doc.save();
}
