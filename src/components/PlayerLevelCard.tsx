import { playerLevelProgress, type PlayerLevel } from "../lib/gamification";

export const PlayerLevelCard = ({ xp, levels }: { xp: number; levels: PlayerLevel[] }) => {
  const { current, next, remaining, percent } = playerLevelProgress(xp, levels);
  if (!current) return null;
  return (
    <section className="mt-5 rounded-2xl bg-background p-5 ring-1 ring-white/10" aria-label="Nível e próxima meta">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-xs uppercase tracking-widest text-white/50">NÍVEL DO DEV</p><h3 className="mt-2 text-xl font-bold text-white">{current.icon} {current.title}</h3><p className="mt-2 text-sm text-white/60">{current.description}</p></div>
        <span className="shrink-0 rounded-xl bg-brand-lavender/20 px-4 py-3 text-center font-bold text-brand-pink">{current.level}<span className="block text-xs uppercase text-white/60">Nível</span></span>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-bold text-brand-ice">{xp.toLocaleString("pt-BR")} XP</span><span className="text-white/65">{next ? `${remaining.toLocaleString("pt-BR")} XP para ${next.title}` : "Nível máximo alcançado!"}</span></div>
      <progress className="mt-3 h-3 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-white/10 [&::-webkit-progress-value]:bg-brand-lavender [&::-moz-progress-bar]:bg-brand-lavender" value={percent} max={100} aria-label="Progresso até o próximo nível" />
      <details className="mt-4">
        <summary className="cursor-pointer py-2 text-sm font-semibold text-brand-lavender">Conheça os dez níveis</summary>
        <ol className="mt-3 space-y-2">{[...levels].sort((a,b) => a.level-b.level).map((level,index,list) => <li key={level.level} className={`flex items-center justify-between gap-3 rounded-xl p-3 ${level.level === current.level ? "bg-brand-lavender/20 ring-1 ring-brand-lavender/40" : "bg-surface"}`}>
          <div><p className="font-semibold text-white">{level.icon} {level.level}. {level.title}</p><p className="mt-1 text-xs text-white/55">{level.description}</p></div>
          <span className="shrink-0 text-xs text-brand-ice">{level.min_xp.toLocaleString("pt-BR")}{list[index+1] ? `–${(list[index+1].min_xp-1).toLocaleString("pt-BR")}` : "+"} XP</span>
        </li>)}</ol>
      </details>
    </section>
  );
};
