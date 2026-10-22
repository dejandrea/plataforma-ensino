import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type RankedPlayer = { position: number; student_id: string; display_name: string; xp: number; level: number };
export const PlayerRanking = () => {
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const update = () => setRefresh(value => value + 1);
    window.addEventListener("gamification-updated", update);
    return () => window.removeEventListener("gamification-updated", update);
  }, []);
  useEffect(() => {
    let cancelled = false;
    void Promise.all([supabase.rpc("gamification_ranking"), supabase.auth.getUser()]).then(([ranking, user]) => {
      if (cancelled) return;
      if (ranking.error) setError("Não foi possível carregar a classificação.");
      else { setPlayers(ranking.data || []); setUserId(user.data.user?.id || ""); }
    });
    return () => { cancelled = true; };
  }, [refresh]);
  return <section className="mt-8 rounded-3xl bg-surface p-6 ring-1 ring-white/10"><h2 className="text-2xl font-bold text-white">Classificação geral</h2><p className="mt-2 text-sm text-white/60">Classificação individual por XP. Alunos com a mesma pontuação compartilham a posição.</p>{error ? <p role="alert" className="mt-4 text-rose-300">{error}</p> : <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Até 100 alunos com mais XP</caption><thead className="text-white/50"><tr><th className="p-3" scope="col">Posição</th><th className="p-3" scope="col">Aluno</th><th className="p-3" scope="col">Nível</th><th className="p-3" scope="col">XP</th></tr></thead><tbody>{players.map(player => <tr key={player.student_id} className={player.student_id === userId ? "bg-brand-lavender/20 text-white" : "border-t border-white/10 text-white/75"}><td className="p-3">{player.position}º</td><th scope="row" className="p-3 font-semibold">{player.display_name}{player.student_id === userId ? " (você)" : ""}</th><td className="p-3">{player.level}</td><td className="p-3 font-bold text-brand-ice">{player.xp.toLocaleString("pt-BR")}</td></tr>)}</tbody></table></div>}</section>;
};
