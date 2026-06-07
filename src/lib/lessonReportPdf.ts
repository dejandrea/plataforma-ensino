type LessonReportLesson = {
  title: string;
  session_track: string;
  starts_at: string;
  ends_at: string;
};

type DownloadLessonReportPdfParams = {
  studentName: string;
  periodLabel: string;
  hourlyRate: number | null;
  totalLessons: number;
  totalHours: number;
  totalAmount: number;
  lessons: LessonReportLesson[];
};

const PDF_PAGE_WIDTH = 595;
const PDF_PAGE_HEIGHT = 842;
const PDF_MARGIN_X = 48;
const PDF_MARGIN_TOP = 54;
const PDF_LINE_HEIGHT = 18;
const PDF_BODY_FONT_SIZE = 12;
const PDF_TITLE_FONT_SIZE = 18;
const PDF_SUBTITLE_FONT_SIZE = 11;
const PDF_MAX_CHARS = 78;

const sanitizePdfText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const wrapLine = (line: string, maxChars = PDF_MAX_CHARS) => {
  if (line.length <= maxChars) return [line];

  const words = line.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
};

const buildPages = (lines: string[]) => {
  const pages: string[][] = [[]];
  let currentLineCount = 0;
  const maxLinesPerPage = Math.floor((PDF_PAGE_HEIGHT - PDF_MARGIN_TOP * 2) / PDF_LINE_HEIGHT);

  for (const line of lines) {
    if (currentLineCount >= maxLinesPerPage) {
      pages.push([]);
      currentLineCount = 0;
    }

    pages[pages.length - 1].push(line);
    currentLineCount += 1;
  }

  return pages;
};

const buildPdfBytes = (pages: string[][]) => {
  const objects: string[] = [];
  const pageRefs: string[] = [];
  const fontObjectId = 3 + pages.length * 2;

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Count 0 /Kids [] >>");

  pages.forEach((pageLines, index) => {
    const pageObjectId = 3 + index * 2;
    const contentObjectId = pageObjectId + 1;
    pageRefs.push(`${pageObjectId} 0 R`);

    const commands: string[] = [];
    let y = PDF_PAGE_HEIGHT - PDF_MARGIN_TOP;

    pageLines.forEach((line, lineIndex) => {
      const isTitle = index === 0 && lineIndex === 0;
      const isSubtitle = index === 0 && lineIndex > 0 && lineIndex < 4;
      const fontSize = isTitle
        ? PDF_TITLE_FONT_SIZE
        : isSubtitle
          ? PDF_SUBTITLE_FONT_SIZE
          : PDF_BODY_FONT_SIZE;
      commands.push(
        `BT /F1 ${fontSize} Tf ${PDF_MARGIN_X} ${y} Td (${sanitizePdfText(line)}) Tj ET`,
      );
      y -= PDF_LINE_HEIGHT;
    });

    const stream = commands.join("\n");
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  objects[1] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageRefs.join(" ")}] >>`;
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(pdf);
};

export const downloadLessonReportPdf = ({
  studentName,
  periodLabel,
  hourlyRate,
  totalLessons,
  totalHours,
  totalAmount,
  lessons,
}: DownloadLessonReportPdfParams) => {
  const lines: string[] = [];

  lines.push("Relatorio de aulas realizadas");
  lines.push(`Aluno: ${studentName}`);
  lines.push(`Periodo: ${periodLabel}`);
  lines.push("");
  lines.push("Datas das aulas realizadas:");

  lessons.forEach((lesson, index) => {
    const trackLabel =
      lesson.session_track === "course" ? "Curso completo" : "Mentoria";
    const hours = (new Date(lesson.ends_at).getTime() - new Date(lesson.starts_at).getTime()) / 3_600_000;
    lines.push(
      `${index + 1}. ${formatDateTime(lesson.starts_at)} - ${trackLabel} - ${hours.toFixed(1)}h`,
    );
    wrapLine(`   ${lesson.title}`).forEach((wrappedLine) => lines.push(wrappedLine));
  });

  lines.push("");
  lines.push("Resumo do periodo:");
  lines.push(`Quantidade de aulas: ${totalLessons}`);
  lines.push(`Carga horaria total: ${totalHours.toFixed(1)}h`);
  lines.push(
    `Valor hora/aula: ${hourlyRate != null ? formatCurrency(hourlyRate) : "Nao definido"}`,
  );
  lines.push(`Total: ${formatCurrency(totalAmount)}`);

  const pdfBytes = buildPdfBytes(buildPages(lines));
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `relatorio-aulas-${studentName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}-${periodLabel
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
};
