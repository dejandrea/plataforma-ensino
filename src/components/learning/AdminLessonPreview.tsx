import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ActivityRenderer } from './ActivityRenderer';
import { LessonActivityList } from './LessonActivityList';
import type { LearningActivity, LessonActivityRow } from '../../types/learning';

export default function AdminLessonPreview({ lessonId, activities, onClose }: {
  lessonId: string; activities?: LearningActivity[]; onClose?: () => void;
}) {
  const [saved, setSaved] = useState<LearningActivity[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!activities);
  useEffect(() => {
    if (activities) return;
    let active = true;
    supabase.from('lesson_activities').select('id,lesson_id,key,title,description,activity_type,content_json,order_index,duration_minutes,is_required,is_active,publication_status,revision,created_at,updated_at,published_at')
      .eq('lesson_id', lessonId).eq('is_active', true).order('order_index').then(({ data, error: cause }) => {
        if (!active) return;
        if (cause) setError('Não foi possível carregar a prévia. Tente novamente.');
        else { const rows = (data as LessonActivityRow[] ?? []).map(a => ({ ...a, is_unlocked: true, prerequisite_ids: [] })); setSaved(rows); setSelected(rows[0]?.id ?? null); }
        setLoading(false);
      });
    return () => { active = false; };
  }, [lessonId, activities]);
  const rows = activities ?? saved;
  return <section aria-label="Visualização como aluno" className="my-5 min-w-0 space-y-4 rounded-3xl border border-brand-purple/40 p-3 md:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-bold text-white">Visualização como aluno</h3>{onClose && <button type="button" className="btn-secondary" onClick={onClose}>Fechar visualização</button>}</div>
    <p className="text-sm text-white/65">Prévia dos materiais e enunciados, incluindo rascunhos. As seções podem ser abertas livremente. Não registra progresso, entregas ou XP.</p>
    {loading && <p role="status">Carregando conteúdo…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !error && !rows.length && <p className="text-white/65">Nenhuma atividade importada nesta aula.</p>}
    <LessonActivityList activities={rows} progress={[]} selectedId={selected} busy={false}
      onSelect={a => setSelected(current => current === a.id ? null : a.id)} renderContent={a => <>
        <p className="mb-4 text-xs text-brand-ice">{a.publication_status === 'published' ? 'Publicado' : 'Rascunho'}</p>
        {a.duration_minutes && <p className="mb-4 text-xs text-white/60">{a.duration_minutes} min estimados</p>}
        {a.description && <p className="mb-5 whitespace-pre-wrap text-sm leading-7 text-white/75">{a.description}</p>}
        <ActivityRenderer activity={a} status="not_started" disabled={true} preview attempts={[]} meetings={[]} submissions={[]} reviews={[]}
          onCompleteStudy={() => {}} onSubmitQuiz={async () => { throw new Error('Prévia sem envio'); }} onQuizBusy={() => {}} onProjectSaved={async () => {}} />
      </>} />
  </section>;
}
