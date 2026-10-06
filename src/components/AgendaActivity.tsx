export function AgendaActivity({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex justify-center px-4">
      <div role="status" aria-live="polite" aria-atomic="true" className="flex items-center gap-3 rounded-2xl bg-brand-900/95 px-5 py-3 text-sm font-semibold text-white shadow-xl ring-1 ring-white/20 backdrop-blur">
        <span aria-hidden="true" className="flex gap-1">
          {[0, 1, 2].map((dot) => (
            <span key={dot} className="h-2 w-2 animate-bounce rounded-full bg-brand-lavender motion-reduce:animate-none" style={{ animationDelay: `${dot * 150}ms` }} />
          ))}
        </span>
        Atualizando agenda...
      </div>
    </div>
  );
}
