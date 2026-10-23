import AdminLessonPreview from './AdminLessonPreview';
import { useMemo, useState } from 'react';
import { toStudentLesson, validateLessonImport } from '../../lib/learningContent';
import { importLearningLesson, publishLearningActivities } from '../../lib/studentLearning';
import { safeHttpsUrl } from '../../lib/learningProgress';
import type { ActivityDefinition, LearningActivity } from '../../types/learning';

function definitionActivity(a: ActivityDefinition, lessonId: string): LearningActivity {
  return { id: a.key, lesson_id: lessonId, key: a.key, title: a.title, description: a.description ?? null,
    activity_type: a.type, content_json: a.content, order_index: a.orderIndex, duration_minutes: a.durationMinutes ?? null,
    is_required: a.required, is_active: true, publication_status: 'draft', revision: 1, created_at: '', updated_at: '',
    published_at: null, is_unlocked: true, prerequisite_ids: [] } as LearningActivity;
}

function Preview({ activity }: { activity: ActivityDefinition }) {
  const c = activity.content;
  return <article className="space-y-3 rounded-2xl bg-background p-4 text-sm text-white/75">
    <h4 className="font-bold text-white">{activity.title} · {activity.required ? 'Obrigatória' : 'Opcional'}</h4>
    {c.type === 'quiz' && c.questions.map(q => <div key={q.key}><p className="font-semibold">{q.prompt}</p><ul className="list-disc pl-5">{q.options.map(o => <li key={o.key}>{o.text}</li>)}</ul></div>)}
    {c.type === 'interactive' && <><p>{c.instructions}</p>{c.interactionType === 'ordering' ? <ul>{c.items.map(i => <li key={i.id}>{i.label}</li>)}</ul> : <div className="grid gap-3 sm:grid-cols-2"><ul>{c.leftItems.map(i => <li key={i.id}>{i.label}</li>)}</ul><ul>{c.rightItems.map(i => <li key={i.id}>{i.label}</li>)}</ul></div>}<p className="text-xs text-brand-ice">Os itens serão apresentados em ordem aleatória em cada tentativa.</p></>}
    {c.type === 'project' && <p>{c.instructions}</p>}
    {c.type === 'online_lesson' && <p>{c.objective}</p>}
    {(c.type === 'slides' || c.type === 'mindmap') && safeHttpsUrl(c.resourceUrl) && <a href={safeHttpsUrl(c.resourceUrl)!} target="_blank" rel="noopener noreferrer" className="text-brand-ice underline">{c.altText} ↗</a>}
    {activity.gamification && <p className="text-xs text-white/60">Regra de recompensa: {activity.gamification.rewardRuleKey}. O valor é controlado pela configuração central de XP.</p>}
  </article>;
}

export default function LessonContentImporter({ lessonId, lessonTitle, onClose }: { lessonId: string; lessonTitle: string; onClose: () => void }) {
  const [showPreview, setShowPreview] = useState(false);
  const [source, setSource] = useState('');
  const [publish, setPublish] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [imported, setImported] = useState<{ activityIds: string[]; published: boolean } | null>(null);
  const validation = useMemo(() => {
    if (!source.trim()) return null;
    if (source.length > 2000000) return { valid: false as const, errors: ['O arquivo deve ter no máximo 2 MB.'] };
    try { return validateLessonImport(JSON.parse(source)); } catch { return { valid: false as const, errors: ['Não foi possível ler o JSON. Confira a sintaxe do arquivo.'] }; }
  }, [source]);
  const preview = validation?.valid ? toStudentLesson(validation.data) : null;
  const correctLesson = preview?.lesson.title === lessonTitle;
  function change(text: string) { setSource(text); setMessage(''); setImported(null); }
  async function save() {
    if (!validation?.valid || !correctLesson || saving || imported) return;
    setSaving(true); setMessage('');
    try { const result = await importLearningLesson(lessonId, validation.data, publish); setImported(result); setMessage(result.published ? 'Atividades importadas e publicadas.' : 'Rascunho importado. Confira a prévia antes de publicar.'); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Não foi possível importar.'); }
    finally { setSaving(false); }
  }
  async function publishDraft() {
    if (!imported || saving) return;
    setSaving(true);
    try { await publishLearningActivities(lessonId, imported.activityIds); setImported({ ...imported, published: true }); setMessage('Atividades publicadas.'); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Não foi possível publicar.'); }
    finally { setSaving(false); }
  }
  return <section aria-label={`Importar atividades para ${lessonTitle}`} className="mt-5 space-y-5 rounded-3xl border border-brand-purple/40 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-bold text-white">Importar atividades — {lessonTitle}</h3><button type="button" disabled={saving} className="btn-secondary" onClick={onClose}>Fechar importação</button></div>
    <p className="text-sm leading-6 text-white/65">Escolha um arquivo v1 ou v2. A importação atualiza descrição, duração e objetivos desta aula e adiciona atividades novas; conteúdos existentes não serão sobrescritos.</p>
    <label className="block text-sm font-semibold text-white">Arquivo JSON<input type="file" accept="application/json,.json" disabled={saving} className="mt-2 block w-full text-sm" onChange={async event => {
      const file = event.target.files?.[0]; if (!file) return;
      if (file.size > 2000000) { change(''); setMessage('O arquivo deve ter no máximo 2 MB.'); return; }
      try { change(await file.text()); } catch { setMessage('Não foi possível ler o arquivo.'); }
    }} /></label>
    <label className="block text-sm font-semibold text-white">Conteúdo JSON<textarea value={source} disabled={saving} onChange={event => change(event.target.value)} rows={10} className="mt-2 w-full rounded-xl bg-background p-3 font-mono text-xs text-white ring-1 ring-white/20" /></label>
    {validation && !validation.valid && <ul role="alert" className="max-h-44 overflow-auto text-sm text-red-200">{validation.errors.slice(0,15).map((error,index) => <li key={index}>{error}</li>)}</ul>}
    {preview && <><p className="text-sm text-brand-ice">Contrato v{preview.schemaVersion} válido · {preview.context.courseTitle} / {preview.context.moduleTitle} / {preview.context.submoduleTitle}</p>
      {!correctLesson && <p role="alert" className="text-sm text-red-200">O título do arquivo deve corresponder à aula de destino.</p>}
      <button type="button" className="btn-secondary" onClick={() => setShowPreview(value => !value)}>{showPreview ? 'Recolher resultado' : 'Visualizar resultado como aluno'}</button>
      {showPreview && <AdminLessonPreview lessonId={lessonId} activities={preview.activities.map(a => ({ ...definitionActivity(a, lessonId), publication_status: imported?.published ? 'published' : 'draft' }))} />}
      <section aria-label="Prévia pública das atividades" className="space-y-3">{preview.activities.map(activity => <Preview key={activity.key} activity={activity} />)}</section>
    </>}
    <label className="flex items-center gap-3 text-sm text-white"><input type="checkbox" checked={publish} disabled={saving || Boolean(imported)} onChange={event => setPublish(event.target.checked)} />Publicar após validar a importação</label>
    <button type="button" className="btn-primary" disabled={saving || !validation?.valid || !correctLesson || Boolean(imported)} onClick={() => void save()}>{saving ? 'Salvando…' : 'Importar atividades'}</button>
    {imported && !imported.published && <button type="button" className="btn-secondary ml-3" disabled={saving} onClick={() => void publishDraft()}>Publicar atividades importadas</button>}
    {message && <p role="status" className="text-sm text-brand-ice">{message}</p>}
  </section>;
}
