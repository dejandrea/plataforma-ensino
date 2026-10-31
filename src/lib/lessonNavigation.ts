export type NavigationLesson = { id: string; title: string; submodule_id: string; order_index: number; publication_status: string };
export type NavigationSubmodule = { id: string; module_id: string; order_index: number };
export type NavigationModule = { id: string; course_id: string; order_index: number };

/** Inputs contain only rows visible to the current student through RLS. */
export function nextAvailableLesson(currentId: string, lessons: NavigationLesson[], submodules: NavigationSubmodule[], modules: NavigationModule[]) {
  const sub = new Map(submodules.map(s => [s.id, s]));
  const mod = new Map(modules.map(m => [m.id, m]));
  const current = lessons.find(l => l.id === currentId);
  const course = current && mod.get(sub.get(current.submodule_id)?.module_id ?? '')?.course_id;
  if (!course) return null;
  const ordered = lessons.filter(l => mod.get(sub.get(l.submodule_id)?.module_id ?? '')?.course_id === course)
    .sort((a, b) => {
      const sa = sub.get(a.submodule_id)!, sb = sub.get(b.submodule_id)!;
      return mod.get(sa.module_id)!.order_index - mod.get(sb.module_id)!.order_index || sa.module_id.localeCompare(sb.module_id)
        || sa.order_index - sb.order_index || sa.id.localeCompare(sb.id) || a.order_index - b.order_index || a.id.localeCompare(b.id);
    });
  return ordered.slice(ordered.findIndex(l => l.id === currentId) + 1).find(l => l.publication_status === 'published') ?? null;
}
