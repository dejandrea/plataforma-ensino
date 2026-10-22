import { safeHttpsUrl, safeVideoEmbed } from '../../lib/learningProgress';
import type { LearningLesson } from '../../types/learning';

/** Keep existing video/PDF/slides lessons usable without migrating their content. */
export function LegacyLessonContent({ lesson }: { lesson: LearningLesson }) {
  const embed = safeVideoEmbed(lesson.video_url);
  const resources = [
    { label: 'Abrir vídeo', url: safeHttpsUrl(lesson.video_url) },
    { label: 'Abrir PDF ou slides', url: safeHttpsUrl(lesson.pdf_url) },
    { label: 'Abrir apresentação', url: safeHttpsUrl(lesson.slides_url) },
    { label: 'Entrar no encontro', url: safeHttpsUrl(lesson.meet_link) },
  ].filter(resource => resource.url);
  return <section aria-label="Conteúdo da aula" className="space-y-6 rounded-3xl bg-surface p-6 ring-1 ring-white/10">
    {embed && <iframe className="aspect-video w-full rounded-2xl" src={embed} title={`Vídeo: ${lesson.title}`} allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}
    <h2 className="text-xl font-bold text-white">Materiais de estudo</h2>
    {resources.length ? <ul className="space-y-3">{resources.map(resource => <li key={resource.label}>
      <a href={resource.url!} target="_blank" rel="noopener noreferrer" className="btn-secondary">{resource.label} ↗</a>
    </li>)}</ul> : <p className="text-sm text-white/65">Esta aula ainda não possui materiais adicionais.</p>}
  </section>;
}
