import { createLessonReportPdf, type LessonReportParams, type ReportAssets } from './lessonReportPdfDocument';
import bodyFont from '../assets/fonts/Inter.ttf?url';
import headingFont from '../assets/fonts/ChakraPetch-Bold.ttf?url';
import logo from '../assets/logo/logo-horizontal-para-fundo-escuro.png';
import mascot from '../assets/Mascote Bitara/mascote 1.png';

let assetPromise: Promise<ReportAssets> | undefined;
function loadAssets() {
  assetPromise ??= Promise.all([bodyFont, headingFont, logo, mascot].map(async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Não foi possível carregar os recursos do relatório. Tente novamente.');
    return new Uint8Array(await response.arrayBuffer());
  })).then(([bodyFont, headingFont, logo, mascot]) => ({ bodyFont, headingFont, logo, mascot })).catch(error => {
    assetPromise = undefined; throw error;
  });
  return assetPromise;
}
export async function downloadLessonReportPdf(data: LessonReportParams) {
  const bytes = await createLessonReportPdf(data, await loadAssets());
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const slug = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `relatorio-aulas-${slug(data.studentName)}-${slug(data.periodLabel)}.pdf`;
  document.body.append(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
