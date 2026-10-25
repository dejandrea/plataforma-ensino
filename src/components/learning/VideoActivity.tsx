import { useState } from 'react';
import { driveVideoPreview, safeHttpsUrl } from '../../lib/learningProgress';
import type { VideoContent } from '../../types/learning';

export function VideoActivity({ content, title, completed, disabled, preview, onComplete }: {
  content: VideoContent; title: string; completed: boolean; disabled: boolean; preview: boolean; onComplete: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const embed = driveVideoPreview(content.resourceUrl);
  const url = embed ? safeHttpsUrl(content.resourceUrl) : null;
  return <div className="min-w-0 space-y-5">
    {embed && url ? <>
      {!failed && <iframe key={attempt} title={`Vídeo: ${title}`} src={embed} allow="fullscreen" allowFullScreen
        sandbox="allow-scripts allow-same-origin" referrerPolicy="strict-origin-when-cross-origin" loading="lazy"
        onError={() => setFailed(true)} className="aspect-video w-full rounded-2xl border border-white/10 bg-black" />}
      {failed && <div role="alert" className="space-y-3 rounded-2xl border border-amber-200/25 p-4 text-sm text-amber-200">
        <p>Não foi possível carregar a prévia do vídeo. Abra em nova aba ou tente novamente.</p>
      </div>}
      <div className="flex flex-wrap gap-3">
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary">Abrir vídeo em nova aba ↗</a>
        <button type="button" className="btn-secondary" onClick={() => { setAttempt(value => value + 1); setFailed(false); }}>Recarregar vídeo</button>
      </div>
      <p className="text-xs leading-5 text-white/60">Se o vídeo não carregar ou o Google pedir acesso, abra em nova aba. Se ainda não abrir, avise sua professora.</p>
    </> : <p role="alert" className="text-sm text-amber-200">Vídeo indisponível. Avise sua professora para conferir o link do Google Drive.</p>}
    <p className="text-sm leading-6 text-white/65">Assista ao vídeo antes de confirmar a conclusão. Abrir ou reproduzir o vídeo não conclui a atividade.</p>
    {preview && <p className="text-sm text-brand-ice">Prévia: assistir não registra progresso ou XP.</p>}
    <button type="button" disabled={disabled || completed || !embed} onClick={onComplete} className="btn-primary">
      {completed ? 'Vídeo concluído' : 'Concluir vídeo'}
    </button>
  </div>;
}
