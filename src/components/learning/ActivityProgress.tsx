import { activityStatusLabels } from '../../lib/learningProgress';
import type { ActivityStatus } from '../../types/learning';

export function ActivityProgress({ completed, total, percent }: { completed: number; total: number; percent: number }) {
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="font-semibold text-white">Seu progresso</span>
      <span className="text-white/65">{total ? `${completed} de ${total} atividades obrigatórias concluídas` : 'Esta aula não possui atividades obrigatórias.'}</span>
    </div>
    {total > 0 && <div role="progressbar" aria-label="Atividades obrigatórias concluídas" aria-valuemin={0} aria-valuemax={total} aria-valuenow={completed}
      aria-valuetext={`${percent}%`} className="h-3 overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full bg-brand-purple transition-[width]" style={{ width: `${percent}%` }} />
    </div>}
  </div>;
}

export function ActivityStatusBadge({ status }: { status: ActivityStatus }) {
  const colors = status === 'completed' ? 'bg-emerald-400/10 text-emerald-300' : status === 'needs_revision'
    ? 'bg-amber-300/10 text-amber-200' : 'bg-white/5 text-white/65';
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${colors}`}>{activityStatusLabels[status]}</span>;
}
