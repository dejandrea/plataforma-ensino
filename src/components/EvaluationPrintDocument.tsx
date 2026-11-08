import {evaluationCriteria} from '../lib/evaluationDraft';
import {evaluationTitle} from '../lib/evaluationPeriods';
import logo from '../assets/logo/logo-horizontal.png';

export type PrintableEvaluation = {
  created_at?: string; reference_month?: string | null; modules?: {title?: string; courses?: {title?: string} | null} | null;
  teacher_comment?: string | null; ai_feedback_json?: Record<string, unknown> | null;
  [key: string]: unknown;
};
export const evaluationPrintCss = `
@page { size: A4; margin: 15mm 16mm; }
* { box-sizing: border-box; }
html,body { margin:0; padding:0; background:white; color:#231b33; font-family:Arial,sans-serif; font-size:11pt; }
.evaluation-paper { width:100%; line-height:1.5; }
.evaluation-head { border-bottom:2px solid #aa54cc; padding-bottom:12px; margin-bottom:16px; }
.evaluation-logo { width:180px; height:auto; max-height:60px; object-fit:contain; object-position:left; }
h1 { font-size:21pt; line-height:1.2; margin:10px 0; }
h2 { font-size:12pt; margin:0 0 6px; break-after:avoid; }
.evaluation-meta { display:grid; grid-template-columns:1fr 1fr; gap:5px 22px; font-size:10pt; }
.evaluation-meta p { margin:0; overflow-wrap:anywhere; }
.evaluation-criterion { border-bottom:1px solid #ded8e5; padding:4px 0; break-inside:avoid; }
.evaluation-score { float:right; font-weight:bold; color:#663285; margin-left:14px; }
.evaluation-text { white-space:pre-wrap; overflow-wrap:anywhere; margin:4px 0; orphans:3; widows:3; }
.evaluation-section { margin-top:18px; }
.evaluation-foot { display:table; width:100%; margin-top:8px; padding-top:4px; border-top:1px solid #ded8e5; font-size:9pt; line-height:1.3; color:#555; break-inside:avoid; }
@media print {
  button,nav {display:none!important;} .evaluation-paper {max-width:none;}
}
`;

export function EvaluationPrintDocument({evaluation, studentName}: {evaluation: PrintableEvaluation; studentName: string}) {
  const feedback = evaluation.ai_feedback_json && typeof evaluation.ai_feedback_json === 'object' && !Array.isArray(evaluation.ai_feedback_json)
    ? evaluation.ai_feedback_json : {};
  const general = typeof feedback.general === 'string' ? feedback.general : '';
  const comment = typeof evaluation.teacher_comment === 'string' ? evaluation.teacher_comment : '';
  const date = evaluation.created_at ? new Date(evaluation.created_at) : null;
  const course = evaluation.modules?.courses?.title;
  return <article className="evaluation-paper">
    <header className="evaluation-head">
      <img className="evaluation-logo" src={logo} alt="Bitaria" />
      <h1>Avaliação individual do aluno</h1>
      <div className="evaluation-meta">
        <p><strong>Aluno:</strong> {studentName || 'Nome não informado'}</p>
        <p><strong>Registrada em:</strong> {date && Number.isFinite(date.getTime()) ? date.toLocaleDateString('pt-BR', {timeZone: 'America/Bahia'}) : 'Não informada'}</p>
        <p><strong>{evaluation.reference_month ? 'Período' : 'Módulo'}:</strong> {evaluationTitle(evaluation)}</p>
        <p><strong>Modalidade:</strong> {evaluation.reference_month ? 'Mentoria' : 'Curso'}{course ? ` — ${course}` : ''}</p>
      </div>
    </header>
    <section aria-label="Critérios avaliados">
      {evaluationCriteria.map(({id, label}) => {
        const value = evaluation[`score_${id}`];
        const score = typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5 ? `${value}/5` : 'Não registrado';
        const text = typeof feedback[id] === 'string' ? feedback[id] as string : '';
        return <section className="evaluation-criterion" key={id}>
          <span className="evaluation-score">{score}</span><h2>{label}</h2>
          {text && <p className="evaluation-text">{text}</p>}
        </section>;
      })}
    </section>
    {general && <section className="evaluation-section"><h2>Avaliação geral</h2><p className="evaluation-text">{general}</p></section>}
    {comment && comment !== general && <section className="evaluation-section"><h2>Observações da professora</h2><p className="evaluation-text">{comment}</p></section>}
    {!general && !comment && <p className="evaluation-text">Sem observações registradas.</p>}
    <footer className="evaluation-foot">Bitaria · Acompanhamento pedagógico<br />Documento individual para o aluno e seus responsáveis.</footer>
  </article>;
}
