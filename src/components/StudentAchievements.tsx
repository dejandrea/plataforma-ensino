import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { combineEvaluationXp, xpLabels, type XpEvent } from "../lib/xp";
import { PlayerLevelCard } from "./PlayerLevelCard";
import type { PlayerLevel } from "../lib/gamification";
import { Link } from "react-router-dom";

export const StudentAchievements = () => {
  const [total, setTotal] = useState(0);
  const [levels, setLevels] = useState<PlayerLevel[]>([]);
  const [events, setEvents] = useState<XpEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const update = () => setRefresh(value => value + 1);
    window.addEventListener("gamification-updated", update);
    return () => window.removeEventListener("gamification-updated", update);
  }, []);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const [profile, history, levelResult] = await Promise.all([
          supabase.from("profiles").select("xp_points").eq("id", user.id).single(),
          supabase.from("student_xp_events").select("event_type,source_id,title,points,earned_at")
            .eq("student_id", user.id).eq("active", true).neq("event_type", "evaluation_star")
            .order("earned_at", { ascending: false }).limit(20),
          supabase.from("player_levels").select("level,min_xp,title,description,icon").order("level"),
        ]);
        if (profile.error || history.error || levelResult.error) throw new Error("load");
        const recentEvents = history.data || [];
        const evaluationIds = recentEvents.filter(event => event.event_type === "evaluation").map(event => event.source_id);
        const stars = evaluationIds.length > 0
          ? await supabase.from("student_xp_events").select("event_type,source_id,title,points,earned_at")
            .eq("student_id", user.id).eq("active", true).eq("event_type", "evaluation_star").in("source_id", evaluationIds)
          : { data: [], error: null };
        if (stars.error) throw new Error("load");
        if (!cancelled) {
          setTotal(profile.data.xp_points || 0);
          setLevels(levelResult.data || []);
          setEvents(combineEvaluationXp([...recentEvents, ...(stars.data || [])]));
        }
      } catch {
        if (!cancelled) setError("Não foi possível carregar suas conquistas.");
      } finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [refresh]);
  return (
    <section className="mx-auto max-w-6xl px-4 pt-8" aria-labelledby="student-xp-title">
      <div className="rounded-3xl bg-surface p-6 ring-1 ring-white/10">
        <h2 id="student-xp-title" className="text-xl font-bold text-white">Minhas conquistas</h2>
        {loading ? <p className="mt-3 text-white/60">Carregando conquistas...</p> : error ? <p role="alert" className="mt-3 text-rose-300">{error}</p> : <>
          <p className="mt-3 text-3xl font-extrabold text-brand-ice">{total.toLocaleString("pt-BR")} XP</p>
          <PlayerLevelCard xp={total} levels={levels} />
          <p className="mt-2 text-sm text-white/60">Cada aula, etapa concluída e avaliação recebida faz parte da sua evolução.</p>
          <Link to="/minhas-maestrias" className="mt-4 inline-flex text-sm font-semibold text-brand-lavender underline">Ver minhas maestrias, missões e medalhas</Link>
          {events.length > 0 && <details className="mt-5">
            <summary className="cursor-pointer rounded-xl py-2 font-semibold text-brand-lavender">Últimas conquistas</summary>
            <ul className="mt-3 divide-y divide-white/10">{events.map(event => <li key={`${event.event_type}-${event.source_id}`} className="flex items-start justify-between gap-4 py-3 text-sm">
              <div className="min-w-0"><p className="font-semibold text-white">{xpLabels[event.event_type] || event.event_type}</p><p className="break-words text-white/60">{event.title}</p><p className="mt-1 text-xs text-white/45">{new Date(event.earned_at).toLocaleDateString("pt-BR")}</p></div>
              <span className="shrink-0 font-bold text-brand-ice">+{event.points} XP</span>
            </li>)}</ul>
            <p className="mt-2 text-xs text-white/45">Até 20 registros mais recentes.</p>
          </details>}
        </>}
      </div>
    </section>
  );
};
