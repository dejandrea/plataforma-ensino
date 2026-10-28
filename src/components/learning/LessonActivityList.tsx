import type { ReactNode } from 'react';
import { ActivityStatusBadge } from './ActivityProgress';
import type { LearningActivity, StudentActivityProgressRow } from '../../types/learning';

const typeLabels = { slides: 'Slides', mindmap: 'Mapa mental', video: 'Vídeo', quiz: 'Questionário', online_lesson: 'Aula online', project: 'Miniprojeto', interactive: 'Prática interativa', flashcards:'Cartões didáticos' };

export function LessonActivityList({ activities, progress, selectedId, busy, onSelect, renderContent }: {
  activities: LearningActivity[]; progress: StudentActivityProgressRow[]; selectedId?: string | null; busy: boolean;
  onSelect: (activity: LearningActivity) => void; renderContent?: (activity: LearningActivity) => ReactNode;
}) {
  const byActivity = new Map(progress.map(p => [p.activity_id, p]));
  const byId = new Map(activities.map(a => [a.id, a]));
  return <nav aria-label="Atividades da aula" className="rounded-3xl bg-surface p-4 ring-1 ring-white/10 md:p-5">
    <h2 className="mb-4 text-lg font-bold text-white">Nesta aula</h2>
    <ol className="space-y-3">{activities.map((activity, index) => {
      const progressRow = byActivity.get(activity.id);
      const status = progressRow?.activity_revision === activity.revision ? progressRow.status : 'not_started';
      const locked = !activity.is_unlocked;
      return <li key={activity.id} className="space-y-2">
        <button type="button" disabled={busy || locked} onClick={() => onSelect(activity)}
          aria-expanded={selectedId === activity.id} aria-controls={`activity-panel-${activity.id}`}
          aria-current={selectedId === activity.id ? 'step' : undefined}
          className={`w-full rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${selectedId === activity.id ? 'border-brand-purple bg-brand-purple/10' : 'border-white/10 hover:bg-white/5'}`}>
          <span className="text-xs font-semibold text-brand-lavender">{index + 1}. {typeLabels[activity.activity_type]} · {activity.is_required ? 'Obrigatória' : 'Opcional'}</span>
          <span className="mt-2 block font-bold text-white">{activity.title}</span>
          <span className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <ActivityStatusBadge status={status} />
            <span className="text-xs text-white/60">{locked ? 'Pré-requisitos pendentes' : status === 'not_started' ? 'Iniciar' : status === 'completed' ? 'Revisar' : 'Continuar'}{!locked && (selectedId === activity.id ? ' / Recolher -' : ' / Expandir +')}</span>
          </span>
        </button>
        {selectedId === activity.id && renderContent && <div id={`activity-panel-${activity.id}`} className="min-w-0 p-1 md:p-3">{renderContent(activity)}</div>}
        {locked && <p className="px-2 text-xs leading-5 text-white/60">Antes, conclua: {activity.prerequisite_ids.map(id => byId.get(id)?.title ?? 'atividade temporariamente indisponível — consulte sua professora').join(', ')}.</p>}
      </li>;
    })}</ol>
  </nav>;
}
