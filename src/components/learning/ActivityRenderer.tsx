import { Link } from 'react-router-dom';
import { resourcePreview,safeHttpsUrl } from '../../lib/learningProgress';
import { QuizActivity } from './QuizActivity';
import { InteractiveActivity } from './InteractiveActivity';
import { VideoActivity } from './VideoActivity';
import { FlashcardsActivity } from './FlashcardsActivity';
import ProjectSubmissionForm from './ProjectSubmissionForm';
import type { AssessmentAnswers, ActivityMeeting, ActivityStatus, LearningActivity, ProjectReviewRow, ProjectSubmissionRow, QuizAttemptRow, ResourceContent } from '../../types/learning';

function ResourceActivity({ content, completed, disabled, onComplete }: {
  content: ResourceContent; completed: boolean; disabled: boolean; onComplete: () => void;
}) {
  const url = safeHttpsUrl(content.resourceUrl);
  const preview=resourcePreview(content.resourceUrl);
  return <div className="space-y-5">
    {url ? <>
      {content.format === 'image' && <img src={url} alt={content.altText} referrerPolicy="no-referrer" className="max-h-[36rem] w-full rounded-2xl bg-white object-contain" />}
      {content.format === 'pdf' && preview && <iframe title={content.altText} src={preview.url} sandbox={preview.googleDrive?'allow-scripts allow-same-origin':''} referrerPolicy={preview.googleDrive?'strict-origin-when-cross-origin':'no-referrer'} loading="lazy" className="h-[32rem] w-full rounded-2xl border border-white/10 bg-white" />}
      <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary">Abrir {content.type === 'slides' ? 'material de estudo' : 'mapa mental'} em nova aba ↗</a>
      {content.format === 'pdf' && <p className="text-xs text-white/55">{preview?.googleDrive?'Se o Google pedir acesso, abra o material em nova aba. Se ainda não abrir, avise sua professora.':'Se a prévia não abrir, use o link para consultar o PDF.'}</p>}
    </> : <p role="alert" className="text-sm text-amber-200">Material indisponível. Avise sua professora.</p>}
    <p className="text-sm leading-6 text-white/65">Leia o material e revise os conceitos antes de confirmar seu estudo. Abrir o arquivo não conclui a atividade.</p>
    <button type="button" disabled={disabled || completed || !url} onClick={onComplete} className="btn-primary">{completed ? 'Estudo confirmado' : 'Confirmar estudo'}</button>
  </div>;
}

export function ActivityRenderer({ activity, status, disabled, attempts, meetings, submissions, reviews, onCompleteStudy, onSubmitQuiz, onQuizBusy, onProjectSaved, preview = false }: {
  preview?: boolean; activity: LearningActivity; status: ActivityStatus; disabled: boolean; attempts: QuizAttemptRow[]; meetings: ActivityMeeting[];
  submissions: ProjectSubmissionRow[]; reviews: ProjectReviewRow[]; onCompleteStudy: () => void;
  onSubmitQuiz: (answers: AssessmentAnswers, requestId: string) => Promise<QuizAttemptRow>; onQuizBusy: (busy: boolean) => void;
  onProjectSaved: () => Promise<void>;
}) {
  if (!activity.is_unlocked) return <p className="text-sm text-white/65">Conclua os pré-requisitos para iniciar esta atividade.</p>;
  switch (activity.activity_type) {
    case 'flashcards':
      return <FlashcardsActivity key={`${activity.id}-${activity.revision}`} activityId={activity.id} revision={activity.revision} content={activity.content_json} preview={preview} disabled={preview?false:disabled} onSaved={onProjectSaved} onBusyChange={onQuizBusy}/>;
    case 'video':
      return <VideoActivity key={activity.content_json.resourceUrl} content={activity.content_json} title={activity.title}
        completed={status === 'completed'} disabled={disabled || preview} preview={preview} onComplete={onCompleteStudy} />;
    case 'slides':
    case 'mindmap':
      return <ResourceActivity content={activity.content_json} completed={status === 'completed'} disabled={disabled || preview} onComplete={onCompleteStudy} />;
    case 'quiz':
      if (preview) return <div className="space-y-5">{activity.content_json.questions.map((q, index) => <fieldset key={q.key} className="space-y-3 rounded-2xl border border-white/10 p-4"><legend className="font-bold text-white">{index + 1}. {q.prompt}</legend>{q.options.map(o => <label key={o.key} className="flex gap-3 rounded-xl border border-white/10 p-3 text-sm text-white/75"><input type="radio" name={`${activity.id}-${q.key}`} />{o.text}</label>)}</fieldset>)}<p className="text-sm text-white/60">Prévia: respostas não são enviadas nem corrigidas.</p></div>;
      return <QuizActivity key={activity.id} activityId={activity.id} content={activity.content_json} attempts={attempts} disabled={disabled}
        onSubmit={onSubmitQuiz} onBusyChange={onQuizBusy} />;
    case 'interactive':
      if (preview) { const c = activity.content_json; return <div className="space-y-4 text-white/75"><p>{c.instructions}</p>{c.interactionType === 'ordering' ? <ol className="space-y-2">{c.items.map(i => <li key={i.id} className="rounded-xl border border-white/10 p-3">{i.label}</li>)}</ol> : <div className="grid grid-cols-2 gap-3">{[c.leftItems, c.rightItems].map((items, index) => <ul key={index} className="space-y-2">{items.map(i => <li key={i.id} className="rounded-xl border border-white/10 p-3">{i.label}</li>)}</ul>)}</div>}<p className="text-sm text-white/60">Prévia: os itens são embaralhados nas tentativas dos alunos.</p></div>; }
      return <InteractiveActivity key={activity.id} activityId={activity.id} content={activity.content_json} attempts={attempts} disabled={disabled} onSubmit={onSubmitQuiz} onBusyChange={onQuizBusy} />;
    case 'online_lesson': {
      const meeting = meetings[0];
      return <div className="space-y-5 text-sm leading-7 text-white/75">
        <p>{activity.content_json.objective}</p>
        <div><h3 className="font-bold text-white">Prepare-se para o encontro</h3><ul className="mt-2 list-disc space-y-1 pl-5">{activity.content_json.preparation.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
        {meeting ? <div className="rounded-2xl bg-white/5 p-4"><p className="font-bold text-white">Próximo encontro: {meeting.title}</p>
          <p>{new Date(meeting.starts_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
          <Link to={`/sala/aula/${meeting.scheduled_lesson_id}`} className="btn-secondary mt-3">Ver sala do encontro</Link>
          <p className="mt-2 text-xs text-white/60">O acesso ao Meet segue o horário de liberação da sala.</p>
        </div> : <p>Nenhum encontro associado a esta atividade.</p>}
        <p className="rounded-2xl border border-white/10 p-4">A conclusão desta atividade é confirmada pela professora.</p>
      </div>;
    }
    case 'project': {
      const content = activity.content_json;
      const reviewLabels = { in_review: 'Em avaliação', needs_revision: 'Ajustes necessários', approved: 'Aprovado' };
      const sections = [{ title: 'Objetivos', items: content.objectives }, { title: 'Requisitos', items: content.requirements }, { title: 'Critérios de avaliação', items: content.assessmentCriteria }];
      return <div className="space-y-6 text-sm leading-7 text-white/75">
        <p className="whitespace-pre-wrap">{content.instructions}</p>
        {sections.map(({ title, items }) => <section key={title}>
          <h3 className="font-bold text-white">{title}</h3><ul className="mt-2 list-disc space-y-1 pl-5">{items.map((item, index) => <li key={index}>{item}</li>)}</ul>
        </section>)}
        {content.resources.length > 0 && <section><h3 className="font-bold text-white">Materiais de apoio</h3><ul className="mt-2 space-y-2">{content.resources.map((resource, index) => {
          const url = safeHttpsUrl(resource.url);
          return <li key={index}>{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-brand-ice underline">{resource.title} ↗</a> : resource.title}</li>;
        })}</ul></section>}
        <p className="rounded-2xl border border-white/10 p-4">A conclusão depende da aprovação da professora.</p>
        {!preview&&(!submissions.length||status==='needs_revision')&&<ProjectSubmissionForm activityId={activity.id} disabled={disabled} onSaved={onProjectSaved} onBusyChange={onQuizBusy}/>}
        {submissions.length > 0 && <section><h3 className="font-bold text-white">Histórico de entregas e feedback</h3>
          <ol className="mt-3 space-y-4">{submissions.map(submission => {
            const url = safeHttpsUrl(submission.submission_url);
            const corrections = reviews.filter(r => r.submission_id === submission.id);
            return <li key={submission.id} className="rounded-2xl bg-white/5 p-4">
              <p className="font-semibold text-white">Versão {submission.version} · {corrections.length ? reviewLabels[corrections[corrections.length - 1].status] : 'Enviado'}</p>
              {url && <a href={url} target="_blank" rel="noopener noreferrer" className="text-brand-ice underline">Abrir projeto ↗</a>}
              {submission.project_description&&<p className="mt-2 whitespace-pre-wrap break-words">{submission.project_description}</p>}
              {submission.additional_links?.map((link,index)=>{const href=safeHttpsUrl(link.url);return href?<p key={index}><a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-ice underline">{link.description} ↗</a></p>:null;})}
              {submission.student_notes && <p className="mt-2 whitespace-pre-wrap">{submission.student_notes}</p>}
              {corrections.map(review => <div key={review.id} className="mt-3 border-t border-white/10 pt-3"><p className="font-semibold text-white">{reviewLabels[review.status]}{review.grade!=null?` · Nota: ${review.grade}/100`:''}</p><p className="whitespace-pre-wrap">{review.teacher_feedback}</p></div>)}
            </li>;
          })}</ol>
        </section>}
      </div>;
    }
  }
}
