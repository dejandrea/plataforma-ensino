import type { ActivityStatus, StudentLessonLearning } from '../types/learning';

export const activityStatusLabels: Record<ActivityStatus, string> = {
  not_started: 'Não iniciada', in_progress: 'Em andamento', pending_review: 'Aguardando professora',
  completed: 'Concluída', needs_revision: 'Precisa de ajustes',
};

/** Resume saved work first; optional untouched activities do not hide pending requirements. */
export function resumeActivityId(data: Pick<StudentLessonLearning, 'activities' | 'progress'>): string | null {
  const inProgress = data.progress.filter(p => p.status === 'in_progress' || p.status === 'needs_revision')
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const resume = inProgress.find(p => data.activities.some(a => a.id === p.activity_id && a.revision === p.activity_revision && a.is_unlocked));
  if (resume) return resume.activity_id;
  const pending = (a: StudentLessonLearning['activities'][number]) => a.is_unlocked && !data.progress.some(p => p.activity_id === a.id && p.activity_revision === a.revision && p.status === 'completed');
  return data.activities.find(a => a.is_required && pending(a))?.id ?? data.activities.find(pending)?.id
    ?? data.activities.find(a => a.is_unlocked)?.id ?? data.activities[0]?.id ?? null;
}

/** Only the current revision of an active, published requirement counts. */
export function requiredActivityProgress(data: Pick<StudentLessonLearning, 'activities' | 'progress'>) {
  const required = data.activities.filter(a => a.is_required && a.is_active && a.publication_status === 'published');
  const progress = new Map(data.progress.map(p => [p.activity_id, p]));
  const completed = required.filter(a => {
    const p = progress.get(a.id);
    return p?.activity_revision === a.revision && p.status === 'completed';
  }).length;
  return { completed, total: required.length, percent: required.length ? Math.round(completed / required.length * 100) : 0 };
}

/** External content stays a link/preview; never inject or execute author HTML. */
export function safeHttpsUrl(value: string | null | undefined): string | null {
  if (!value || /\s/.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) ? url.href : null;
  } catch { return null; }
}

/** Drive's page URL is not its embedded viewer. Keep link-sharing resource keys. */
export function resourcePreview(value:string) {
  const safe=safeHttpsUrl(value);if(!safe)return null;
  const url=new URL(safe);
  if(url.hostname==='drive.google.com'&&!url.username&&!url.password&&(!url.port||url.port==='443')) {
    const match=url.pathname.match(/^\/file\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)(?:\/(?:view|preview|edit))?\/?$/);
    const id=match?.[1]||(['/open','/uc'].includes(url.pathname)?url.searchParams.get('id'):null);
    if(id&&/^[a-zA-Z0-9_-]+$/.test(id)) {
      const preview=new URL(`https://drive.google.com/file/d/${id}/preview`);
      const key=url.searchParams.get('resourcekey');if(key)preview.searchParams.set('resourcekey',key);
      return {url:preview.href,googleDrive:true};
    }
  }
  return {url:safe,googleDrive:false};
}

/** Only the trusted Drive file viewer may receive video iframe permissions. */
export function driveVideoPreview(value: string): string | null {
  const preview = resourcePreview(value);
  if (!preview?.googleDrive) return null;
  const url = new URL(preview.url);
  const authuser = new URL(value).searchParams.get('authuser');
  if (authuser) url.searchParams.set('authuser', authuser);
  return url.href;
}

export function safeVideoEmbed(value: string | null): string | null {
  const safe = safeHttpsUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  if (url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com' || url.hostname === 'youtu.be') {
    const video = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') ?? url.pathname.split('/embed/')[1];
    return video && /^[a-zA-Z0-9_-]{11}$/.test(video) ? `https://www.youtube-nocookie.com/embed/${video}` : null;
  }
  if (url.hostname === 'player.vimeo.com' && /^\/video\/\d+$/.test(url.pathname)) return url.href;
  return null;
}
