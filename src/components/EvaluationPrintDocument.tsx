import {evaluationCriteria} from '../lib/evaluationDraft';
import {evaluationTitle} from '../lib/evaluationPeriods';
import logo from '../assets/logo/logo-horizontal-para-fundo-escuro.png';
import {EvaluationStars} from './EvaluationStars';
export const evaluationMascot = '/biblioteca-bitara/images/bitara-002.webp';

export type PrintableEvaluation = {
  created_at?: string; reference_month?: string | null; modules?: {title?: string; courses?: {title?: string} | null} | null;
  teacher_comment?: string | null; ai_feedback_json?: Record<string, unknown> | null;
  [key: string]: unknown;
};
export const evaluationPrintCss = `
@page { size: A4; margin: 12mm 14mm 18mm;
  @bottom-left {content:"Bitaria · Aprenda. Crie. Evolua.\\A Acompanhamento pedagógico · Documento individual para o aluno e seus responsáveis."; white-space:pre; font:7.5pt Arial,sans-serif; color:#653078;}
  @bottom-right {content:counter(page) " / " counter(pages); font:8pt Arial,sans-serif; color:#653078;}
}
* { box-sizing: border-box; }
html,body { margin:0; padding:0; background:white; color:#231b33; font-family:Arial,sans-serif; font-size:11pt; }
.evaluation-paper { width:100%; line-height:1.45; }
.evaluation-head { position:relative; background:#201831; color:white; border-bottom:3px solid #db52c5; border-radius:12px; padding:12px 20px; margin-bottom:10px; break-inside:avoid; }
.evaluation-logo { width:148px; height:45px; object-fit:contain; object-position:left; }
.evaluation-slogan {font-size:9pt; margin:0 0 6px; color:#e5d8ec;}
.evaluation-mascot {position:absolute; right:8px; top:8px; width:110px; height:135px; object-fit:contain;}
.evaluation-head h1 {font-size:18pt; line-height:1.2; margin:4px 0 8px; padding-right:100px;}
.evaluation-student {font-size:13pt; margin:0 0 6px; font-weight:bold; padding-right:100px; overflow-wrap:anywhere;}
h2 { font-size:11pt; margin:0 0 6px; break-after:avoid; }
.evaluation-meta { display:grid; grid-template-columns:1fr 1fr; gap:5px 22px; font-size:10pt; }
.evaluation-meta p { margin:0; overflow-wrap:anywhere; }
.evaluation-criteria {columns:2; column-gap:12px;}
.evaluation-criterion { display:inline-block; width:100%; vertical-align:top; background:#faf7fc; border:1px solid #e6dbee; border-top:3px solid #a64fcc; border-radius:10px; padding:8px 12px; margin-bottom:8px; break-inside:avoid; }
.evaluation-stars {display:inline-flex; gap:3px; margin:0 0 4px;}
.evaluation-unrated {font-size:9pt; color:#62516f;}
.evaluation-text { white-space:pre-wrap; overflow-wrap:anywhere; margin:4px 0; orphans:3; widows:3; }
.evaluation-section { margin-top:10px; padding:10px 16px; border-radius:12px; background:#f6edf9; border-left:4px solid #bd42af; break-inside:avoid; }
.evaluation-section h2 {font-size:15pt; color:#653078;}
.evaluation-section .evaluation-text {line-height:1.4;}
.evaluation-subtitle {font-size:10pt; color:#653078; margin:0 0 8px;}
.evaluation-foot strong {color:#653078;}
.evaluation-foot { display:table; width:100%; margin-top:8px; padding-top:4px; border-top:1px solid #ded8e5; font-size:9pt; line-height:1.3; color:#555; break-inside:avoid; }
@media print {
  * {-webkit-print-color-adjust:exact; print-color-adjust:exact;} button,nav {display:none!important;} .evaluation-paper {max-width:none;}
  .evaluation-foot {display:none;}
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
      <p className="evaluation-slogan">Aprenda. Crie. Evolua.</p>
      <img className="evaluation-mascot" src={evaluationMascot} alt="Bitara sorrindo, com um braço levantado em sinal de vitória." />
      <h1>Avaliação individual do aluno</h1>
      <p className="evaluation-student">{studentName || 'Nome não informado'}</p>
      <div className="evaluation-meta">
        <p><strong>Registrada em:</strong> {date && Number.isFinite(date.getTime()) ? date.toLocaleDateString('pt-BR', {timeZone: 'America/Bahia'}) : 'Não informada'}</p>
        <p><strong>{evaluation.reference_month ? 'Período' : 'Módulo'}:</strong> {evaluationTitle(evaluation)}</p>
        <p><strong>Modalidade:</strong> {evaluation.reference_month ? 'Mentoria' : 'Curso'}{course ? ` — ${course}` : ''}</p>
      </div>
    </header>
    <section className="evaluation-criteria" aria-label="Critérios avaliados">
      {evaluationCriteria.map(({id, label}) => {
        const value = evaluation[`score_${id}`];
        const text = typeof feedback[id] === 'string' ? feedback[id] as string : '';
        return <section className="evaluation-criterion" key={id}>
          <h2>{label}</h2><EvaluationStars value={value} />
          {text && <p className="evaluation-text">{text}</p>}
        </section>;
      })}
    </section>
    {general && <section className="evaluation-section" aria-label="Avaliação geral"><h2>Sua evolução merece destaque!</h2><p className="evaluation-subtitle">Uma mensagem especial sobre sua jornada</p><p className="evaluation-text">{general}</p></section>}
    {comment && comment !== general && <section className="evaluation-section"><h2>Observações da professora</h2><p className="evaluation-text">{comment}</p></section>}
    {!general && !comment && <p className="evaluation-text">Sem observações registradas.</p>}
    <footer className="evaluation-foot"><strong>Bitaria · Aprenda. Crie. Evolua.</strong><br />Acompanhamento pedagógico · Documento individual para o aluno e seus responsáveis.</footer>
  </article>;
}
