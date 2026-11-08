import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {EvaluationPrintDocument, evaluationPrintCss, type PrintableEvaluation} from '../components/EvaluationPrintDocument';

/** Private, in-memory document: receives only the evaluation already authorized by the current page's RLS query. */
export async function printEvaluation(evaluation: PrintableEvaluation, studentName: string) {
  const frame = document.createElement('iframe');
  frame.title = 'Impressão da avaliação';
  frame.style.cssText = 'position:fixed;left:-200vw;top:0;width:210mm;height:297mm;border:0;';
  document.body.append(frame);
  const doc = frame.contentDocument, win = frame.contentWindow;
  if (!doc || !win) {frame.remove(); throw new Error('Impressão indisponível.');}
  doc.documentElement.lang = 'pt-BR'; doc.title = 'Avaliação individual - Bitaria';
  const style = doc.createElement('style'); style.textContent = evaluationPrintCss; doc.head.append(style);
  const root = createRoot(doc.body);
  let timer: ReturnType<typeof setTimeout>;
  const dispose = () => {clearTimeout(timer); root.unmount(); frame.remove();};
  try {
    flushSync(() => root.render(<EvaluationPrintDocument evaluation={evaluation} studentName={studentName} />));
    await Promise.all(Array.from(doc.images, image => image.decode()));
    await doc.fonts.ready;
    win.addEventListener('afterprint', dispose, {once: true});
    // Safety cleanup if the browser does not dispatch afterprint (e.g. cancelled dialog).
    timer = setTimeout(dispose, 300_000);
    win.focus(); win.print();
  } catch (error) {dispose(); throw error;}
}
