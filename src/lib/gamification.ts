export type PlayerLevel = { level: number; min_xp: number; title: string; description: string; icon: string };

export const playerLevelProgress = (xp: number, levels: PlayerLevel[]) => {
  const ordered = [...levels].sort((a, b) => a.min_xp - b.min_xp);
  const current = ordered.filter(level => level.min_xp <= xp).at(-1) || ordered[0];
  const next = ordered.find(level => level.min_xp > xp);
  return {
    current,
    next,
    remaining: next ? Math.max(0, next.min_xp - xp) : 0,
    percent: current && next ? Math.min(100, Math.max(0, (xp - current.min_xp) / (next.min_xp - current.min_xp) * 100)) : 100,
  };
};
