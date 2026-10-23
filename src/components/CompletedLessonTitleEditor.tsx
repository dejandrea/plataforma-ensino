import { useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export function CompletedLessonTitleEditor({ lessonId, title, compact = false, disabled = false, onSaved, onBusyChange }: {
  lessonId: string; title: string; compact?: boolean; disabled?: boolean;
  onSaved?: (title: string) => void; onBusyChange?: (busy: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [savedTitle, setSavedTitle] = useState(title);
  const [draft, setDraft] = useState(title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const inFlight = useRef(false);
  async function save() {
    if (inFlight.current || disabled) return;
    const value = draft.trim();
    if (!value) { setError('Informe o título ou assunto da aula.'); return; }
    inFlight.current = true; setSaving(true); setError(''); onBusyChange?.(true);
    try {
      const { data, error: cause } = await supabase.from('scheduled_lessons')
        .update({ title: value }).eq('id', lessonId).eq('status', 'completed').select('title').single();
      if (cause || !data) throw new Error('Não foi possível salvar. Confira sua permissão e se a aula continua concluída.');
      setSavedTitle(data.title); setDraft(data.title); setEditing(false);
      setNotice('Título/assunto salvo. Ele será usado no relatório de aulas.');
      onSaved?.(data.title);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar. Tente novamente.');
    } finally { inFlight.current = false; setSaving(false); onBusyChange?.(false); }
  }
  return <div className="min-w-0 space-y-2">
    <h3 className={`${compact ? 'text-base' : 'text-lg'} break-words font-bold text-white`}>{savedTitle}</h3>
    {editing ? <form aria-label="Editar título ou assunto da aula" className="space-y-3" onSubmit={event => { event.preventDefault(); void save(); }}>
      <label className="block text-sm font-semibold text-white">Título/assunto da aula
        <input autoFocus type="text" value={draft} maxLength={500} disabled={saving || disabled} required
          onChange={event => { setDraft(event.target.value); setError(''); }} className="input mt-2 w-full" />
      </label>
      <div className="flex flex-wrap gap-2"><button type="submit" disabled={saving || disabled || !draft.trim()} className="btn-primary">{saving ? 'Salvando...' : 'Salvar título/assunto'}</button>
        <button type="button" disabled={saving} className="btn-secondary" onClick={() => { setDraft(savedTitle); setEditing(false); setError(''); }}>Cancelar edição</button></div>
    </form> : <button type="button" disabled={disabled} className="text-xs font-semibold text-brand-lavender underline disabled:opacity-50" onClick={() => { setDraft(savedTitle); setEditing(true); setNotice(''); }}>Editar título/assunto</button>}
    {error && <p role="alert" className="text-sm text-red-200">{error}</p>}
    {notice && <p role="status" className="text-xs text-emerald-300">{notice}</p>}
  </div>;
}
