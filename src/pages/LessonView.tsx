import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ActivityProgress, ActivityStatusBadge } from '../components/learning/ActivityProgress';
import { ActivityRenderer } from '../components/learning/ActivityRenderer';
import { LegacyLessonContent } from '../components/learning/LegacyLessonContent';
import { LessonActivityList } from '../components/learning/LessonActivityList';
import { requiredActivityProgress, resumeActivityId } from '../lib/learningProgress';
import { completeStudentLesson, completeStudentStudy, fetchStudentLesson, fetchNextStudentLesson, startStudentActivity, submitStudentAssessment } from '../lib/studentLearning';
import { PlayerLevelCard } from '../components/PlayerLevelCard';
import type { LearningActivity, StudentLessonLearning } from '../types/learning';

function StudentLessonPage({ lessonId }: { lessonId: string }) {
  const [data, setData] = useState<StudentLessonLearning | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const [quizBusy, setQuizBusy] = useState(false);
  const [rewardNotice, setRewardNotice] = useState('');
  const [nextLesson, setNextLesson] = useState<{id: string; title: string} | null>(null);
  const [navigationError, setNavigationError] = useState(false);
  const mutationInFlight = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    let cancelled = false;
    fetchNextStudentLesson(lessonId).then(next => {
      if (!cancelled) { setNextLesson(next); setNavigationError(false); }
    }).catch(() => { if (!cancelled) setNavigationError(true); });
    return () => { cancelled = true; };
  }, [lessonId, reload, data?.completed_at]);

  useEffect(() => {
    let cancelled = false;
    alive.current = true;
    fetchStudentLesson(lessonId).then(next => {
      if (!cancelled) { setData(next); setSelectedId(resumeActivityId(next)); }
    }).catch(cause => {
      if (!cancelled) setLoadError(cause instanceof Error ? cause.message : 'Não foi possível carregar esta aula.');
    });
    return () => { cancelled = true; alive.current = false; };
  }, [lessonId, reload]);

  async function refreshAfterSave() {
    try {
      const next = await fetchStudentLesson(lessonId);
      if (alive.current) {
        if (data?.gamification && next.gamification) {
          const xp = next.gamification.xp - data.gamification.xp;
          const unlocked = next.gamification.achievements.filter(a => !data.gamification?.achievements.some(old => old.code === a.code));
          if (xp > 0 || unlocked.length) setRewardNotice([xp > 0 ? `+${xp} XP recebidos!` : '', ...unlocked.map(a => `${a.icon} Conquista desbloqueada: ${a.title}`)].filter(Boolean).join(' · '));
        }
        setData(next);
      }
    } catch {
      if (alive.current) setNotice('Seu registro foi salvo, mas não foi possível atualizar a página. Use “Atualizar progresso” para consultar o resultado.');
    }
  }

  async function save(action: () => Promise<unknown>) {
    if (mutationInFlight.current || quizBusy) return;
    mutationInFlight.current = true;
    setSaving(true); setActionError(''); setNotice('');
    try { await action(); await refreshAfterSave(); }
    catch (cause) { if (alive.current) setActionError(cause instanceof Error ? cause.message : 'Não foi possível salvar. Tente novamente.'); }
    finally { mutationInFlight.current = false; if (alive.current) setSaving(false); }
  }

  function selectActivity(activity: LearningActivity) {
    if (saving || quizBusy || !activity.is_unlocked) return;
    if (selectedId === activity.id) { setSelectedId(null); return; }
    setSelectedId(activity.id);
    const progress = data?.progress.find(p => p.activity_id === activity.id && p.activity_revision === activity.revision);
    if (!progress || progress.status === 'not_started') void save(() => startStudentActivity(activity.id));
  }

  function retry() {
    setData(null); setLoadError(''); setActionError(''); setNotice(''); setReload(value => value + 1);
  }

  if (loadError) return <main className="app-bg px-4 py-10">
    <div className="mx-auto max-w-3xl rounded-3xl bg-surface p-8 ring-1 ring-white/10">
      <h1 className="text-2xl font-bold text-white">Não foi possível abrir a aula</h1>
      <p role="alert" className="mt-4 leading-7 text-white/70">{loadError}</p>
      <div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={retry} className="btn-primary">Tentar novamente</button><Link to="/dashboard" className="btn-secondary">Voltar para minha jornada</Link></div>
    </div>

  </main>;
  if (!data) return <main className="app-bg px-4 py-10"><p role="status" className="mx-auto max-w-6xl rounded-3xl bg-surface p-10 text-center text-white/70">Carregando sua aula…</p></main>;

  const { lesson } = data;
  const selected = data.activities.find(a => a.id === selectedId);
  const selectedProgress = data.progress.find(p => p.activity_id === selected?.id && p.activity_revision === selected.revision);
  const status = selectedProgress?.status ?? 'not_started';
  const busy = saving || quizBusy;
  const summary = requiredActivityProgress(data);
  const nextActivity = selected ? data.activities.slice(data.activities.indexOf(selected) + 1).find(a => a.is_unlocked) : null;

  return <main className="app-bg" aria-busy={busy}>
    <div className="mx-auto max-w-6xl space-y-7 px-4 py-8 pb-40">
      <Link to="/dashboard" className="inline-block text-sm font-semibold text-brand-lavender hover:underline">← Voltar para minha jornada</Link>
      <header className="space-y-6 rounded-3xl bg-surface p-6 shadow-soft ring-1 ring-white/10 md:p-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div><p className="text-xs font-black uppercase tracking-[0.2em] text-brand-lavender">Seu espaço de aprendizagem</p><h1 className="mt-3 text-3xl font-extrabold text-white md:text-4xl">{lesson.title}</h1></div>
          <span className="shrink-0 rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/65">{lesson.duration_minutes ? `${lesson.duration_minutes} min estimados` : 'Duração livre'}</span>
        </div>
        {lesson.description && <p className="whitespace-pre-wrap text-sm leading-7 text-white/70">{lesson.description}</p>}
        {data.objectives.length > 0 && <section><h2 className="text-base font-bold text-white">O que você vai aprender</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-white/70">{data.objectives.map((objective, index) => <li key={index}>{objective}</li>)}</ul></section>}

        {data.gamification && <PlayerLevelCard xp={data.gamification.xp} levels={data.gamification.levels} />}
      </header>

      {actionError && <p role="alert" className="rounded-2xl bg-red-400/10 p-4 text-sm text-red-200">{actionError}</p>}
      {notice && <p role="status" className="rounded-2xl bg-amber-300/10 p-4 text-sm text-amber-200">{notice}</p>}
      {rewardNotice && <p role="status" className="rounded-2xl bg-emerald-400/10 p-4 text-sm text-emerald-200">{rewardNotice}</p>}
      {saving && <p role="status" className="text-sm text-white/65">Salvando seu progresso…</p>}

      {data.has_activity_model ? data.activities.length ? <LessonActivityList activities={data.activities} progress={data.progress} selectedId={selected?.id ?? null} busy={busy} onSelect={selectActivity}
        renderContent={() => selected ? (<section aria-label="Atividade selecionada" className="min-w-0 space-y-6 rounded-3xl bg-surface p-5 ring-1 ring-white/10 md:p-7">
          <header className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><ActivityStatusBadge status={status} />{selected.duration_minutes && <span className="text-xs text-white/60">{selected.duration_minutes} min estimados</span>}</div>
            <h2 className="text-2xl font-bold text-white">{selected.title}</h2>{selected.description && <p className="text-sm leading-7 text-white/65">{selected.description}</p>}
          </header>
          <ActivityRenderer key={selected.id} activity={selected} status={status} disabled={saving}
            onProjectSaved={refreshAfterSave}
            attempts={data.attempts.filter(a => a.activity_id === selected.id)} meetings={data.meetings.filter(m => m.activity_id === selected.id)}
            submissions={data.submissions.filter(s => s.activity_id === selected.id)} reviews={data.reviews}
            onCompleteStudy={() => void save(() => completeStudentStudy(selected.id))}
            onSubmitQuiz={async (answers, requestId) => {
              const attempt = await submitStudentAssessment(selected.id, answers, requestId);
              await refreshAfterSave();
              return attempt;
            }} onQuizBusy={setQuizBusy} />
        </section>) : null} /> : <section className="rounded-3xl bg-surface p-8 ring-1 ring-white/10"><p className="text-sm text-white/70">O conteúdo desta aula está sendo atualizado. Consulte sua professora para continuar.</p></section>
        : <LegacyLessonContent lesson={lesson} />}

      <footer className="flex flex-col justify-between gap-5 rounded-3xl bg-surface p-6 ring-1 ring-white/10 md:flex-row md:items-center">
        <div><h2 className="font-bold text-white">{data.completed_at ? 'Aula concluída' : 'Sua jornada continua'}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">{data.completed_at ? 'A conclusão está salva na sua jornada. Você pode revisar os materiais quando quiser.' : data.has_activity_model ? 'Sua jornada é atualizada quando todas as atividades obrigatórias são concluídas.' : 'Estude os materiais e confirme a conclusão para atualizar sua jornada.'}</p>
        </div>
        <div className="flex min-w-0 flex-wrap gap-3 md:max-w-sm">
          {nextActivity ? <button type="button" disabled={busy} className="btn-primary" onClick={() => { selectActivity(nextActivity); window.scrollTo({ top: 0, behavior: 'instant' }); }}>Próximo conteúdo →</button>
            : nextLesson && !busy ? <Link to={`/lesson/${nextLesson.id}`} className="btn-primary" aria-label={`Próxima aula: ${nextLesson.title}`}>Próxima aula →</Link> : null}
          {!nextActivity && !nextLesson && navigationError && <p role="status" className="text-sm text-white/65">Não foi possível consultar a próxima aula. Use Atualizar progresso para tentar novamente.</p>}
          <button type="button" disabled={busy} onClick={retry} className="btn-secondary">Atualizar progresso</button>
          <button type="button" disabled={busy || Boolean(data.completed_at) || !data.can_complete} onClick={() => void save(() => completeStudentLesson(lessonId))} className="btn-primary">{data.completed_at ? 'Conclusão registrada' : 'Concluir aula'}</button>
        </div>
      </footer>
    </div>
    {data.has_activity_model && <aside aria-label="Progresso da aula" className="fixed inset-x-0 bottom-0 z-30 border-t border-white/15 bg-surface p-4 shadow-soft"><div className="mx-auto max-w-6xl"><ActivityProgress {...summary} /></div></aside>}
  </main>;
}

export const LessonView = () => {
  const { id } = useParams<{ id: string }>();
  return id ? <StudentLessonPage key={id} lessonId={id} /> : <p role="alert">Aula não encontrada.</p>;
};
