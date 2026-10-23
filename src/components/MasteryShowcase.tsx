import {CatalogIcon} from './CatalogIcon';
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Technology = { id: string; slug: string; name: string; bronze_title: string; silver_title: string; gold_title: string };
type Progress = { technology_id: string; xp: number; completed_missions: number; final_project_approved: boolean };
type Badge = { code: string; title: string; description: string; icon: string };
type EarnedBadge = { code: string; unlocked_at: string };
export type MasteryRule = { tier: "bronze" | "silver" | "gold"; min_xp: number; min_missions: number; requires_project: boolean };
const tiers = [{ id: "bronze", label: "Bronze", color: "text-orange-300" }, { id: "silver", label: "Prata", color: "text-slate-300" }, { id: "gold", label: "Ouro", color: "text-amber-300" }] as const;

export const MasteryShowcase = () => {
  const [technologies, setTechnologies] = useState<Technology[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [earned, setEarned] = useState<EarnedBadge[]>([]);
  const [rules, setRules] = useState<MasteryRule[]>([]);
  const [selected, setSelected] = useState("");
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
        const results = await Promise.all([
          supabase.from("technologies").select("*").order("name"),
          supabase.from("student_technology_progress").select("technology_id,xp,completed_missions,final_project_approved").eq("student_id", user.id),
          supabase.from("achievement_definitions").select("code,title,description,icon").order("title"),
          supabase.from("student_achievements").select("code,unlocked_at").eq("student_id", user.id).eq("active", true),
          supabase.from("mastery_rules").select("*").order("min_xp"),
        ]);
        if (results.some(result => result.error)) throw new Error("load");
        if (!cancelled) {
          setTechnologies(results[0].data || []); setProgress(results[1].data || []);
          setBadges(results[2].data || []); setEarned(results[3].data || []); setRules(results[4].data || []); setError("");
          setSelected(current => current || results[0].data?.[0]?.id || "");
        }
      } catch { if (!cancelled) setError("Não foi possível carregar suas maestrias."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [refresh]);
  const technology = technologies.find(item => item.id === selected);
  const stats = progress.find(item => item.technology_id === selected);
  const next = technology && tiers.find(tier => !earned.some(badge => badge.code === `mastery:${technology.slug}:${tier.id}`));
  const target = rules.find(rule => rule.tier === next?.id);
  return <section className="mt-8 rounded-3xl bg-surface p-6 ring-1 ring-white/10">
    <h2 className="text-2xl font-bold text-white">Minhas Maestrias</h2>
    {loading ? <p className="mt-4 text-white/60">Carregando maestrias...</p> : error ? <p className="mt-4 text-rose-300" role="alert">{error}</p> : <>
      <label className="mt-4 block text-sm text-white/70">Tecnologia<select className="mt-2 w-full rounded-xl bg-background p-3 text-white ring-1 ring-white/20" value={selected} onChange={e => setSelected(e.target.value)}>{technologies.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {technology && <div className="mt-4 rounded-2xl bg-background p-5">
        <h3 className="text-lg font-bold text-white">{technology.name}</h3><p className="mt-2 text-sm text-brand-ice">{Number(stats?.xp || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} XP · {stats?.completed_missions || 0} missões concluídas</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">{tiers.map(tier => {
          const badge = earned.find(item => item.code === `mastery:${technology.slug}:${tier.id}`);
          const rule = rules.find(item => item.tier === tier.id);
          return <div key={tier.id} className={`rounded-2xl p-4 ring-1 ${badge ? "bg-brand-lavender/15 ring-brand-lavender/50" : "bg-surface ring-white/10"}`}>
            <p className={`text-2xl ${tier.color}`} aria-hidden="true">{badge ? "🏅" : "🔒"}</p><h4 className={`mt-2 font-bold ${tier.color}`}>{tier.label}</h4>
            <p className="mt-2 text-sm font-semibold text-white">{technology[`${tier.id}_title`]}</p>
            {rule && <p className="mt-2 text-xs leading-5 text-white/55">{rule.min_xp} XP · {rule.min_missions} missões{rule.requires_project ? " · projeto final concluído" : ""}</p>}
            <p className="mt-3 text-xs text-white/75">{badge ? `Conquistada em ${new Date(badge.unlocked_at).toLocaleDateString("pt-BR")}` : "Bloqueada"}</p>
          </div>;
        })}</div>
        {target ? <div className="mt-5 text-sm text-white/65"><p>Próxima meta: {tiers.find(t => t.id === target.tier)?.label}</p><p className="mt-2">Faltam {Math.max(0, target.min_xp - Number(stats?.xp || 0)).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} XP e {Math.max(0, target.min_missions - (stats?.completed_missions || 0))} missões{target.requires_project && !stats?.final_project_approved ? ", além de um projeto final" : ""}.</p></div> : <p className="mt-5 font-semibold text-brand-ice">Você desbloqueou as três medalhas!</p>}
      </div>}
      <h3 className="mt-7 text-xl font-bold text-white">Vitrine de conquistas</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{badges.map(badge => {
        const unlocked = earned.find(item => item.code === badge.code);
        return <article key={badge.code} className={`rounded-2xl p-5 text-center ring-1 ${unlocked ? "bg-brand-lavender/15 ring-brand-lavender/40" : "bg-background ring-white/10"}`}><span className="text-2xl" aria-hidden="true"><CatalogIcon value={unlocked ? badge.icon : "🔒"}/></span><h4 className="mt-3 font-bold text-white">{badge.title}</h4><p className="mt-2 text-xs leading-5 text-white/60">{badge.description}</p><p className="mt-3 text-xs text-brand-lavender">{unlocked ? `Conquistada em ${new Date(unlocked.unlocked_at).toLocaleDateString("pt-BR")}` : "Bloqueada"}</p></article>;
      })}</div>
    </>}
  </section>;
};

export const MasteryRuleSettings = () => {
  const [rules, setRules] = useState<MasteryRule[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { let cancelled = false; void supabase.from("mastery_rules").select("*").order("min_xp").then(({ data, error }) => { if (!cancelled) { if (error) setMessage("Não foi possível carregar as regras de maestria."); else setRules(data || []); } }); return () => { cancelled = true; }; }, []);
  const save = async (rule: MasteryRule) => {
    if (busy) return;
    if (!Number.isInteger(rule.min_xp) || rule.min_xp < 0 || !Number.isInteger(rule.min_missions) || rule.min_missions < 1) { setMessage("Informe XP inteiro positivo ou zero e pelo menos uma missão."); return; }
    setBusy(true);
    const { error } = await supabase.from("mastery_rules").update({ min_xp: rule.min_xp, min_missions: rule.min_missions, requires_project: rule.requires_project }).eq("tier", rule.tier).select("tier").single();
    setBusy(false); setMessage(error ? "Não foi possível salvar a regra." : "Regra salva. As medalhas foram recalculadas.");
  };
  return <section className="mt-8 rounded-3xl bg-surface p-6 ring-1 ring-white/10"><h2 className="text-2xl font-bold text-white">Regras das maestrias</h2><p className="mt-2 text-sm text-white/60">Os requisitos de XP e missões devem ser cumpridos juntos. Alterar uma regra recalcula os desbloqueios.</p>{message && <p className="mt-3 text-brand-ice" role="status">{message}</p>}<div className="mt-4 grid gap-4 md:grid-cols-3">{rules.map(rule => <form key={rule.tier} onSubmit={e => { e.preventDefault(); void save(rule); }} className="space-y-3 rounded-2xl bg-background p-4"><h3 className="font-bold text-white">{tiers.find(t => t.id === rule.tier)?.label}</h3>{(["min_xp", "min_missions"] as const).map(field => <label key={field} className="block text-sm text-white/65">{field === "min_xp" ? "XP mínimo" : "Missões mínimas"}<input type="number" required min={field === "min_xp" ? 0 : 1} step={1} value={Number.isNaN(rule[field]) ? "" : rule[field]} onChange={e => setRules(current => current.map(item => item.tier === rule.tier ? { ...item, [field]: e.target.valueAsNumber } : item))} className="mt-2 w-full rounded-xl bg-surface p-2 text-white ring-1 ring-white/20" /></label>)}<label className="flex items-center gap-2 text-sm text-white/65"><input type="checkbox" checked={rule.requires_project} onChange={e => setRules(current => current.map(item => item.tier === rule.tier ? { ...item, requires_project: e.target.checked } : item))} />Exige projeto final</label><button type="submit" disabled={busy} className="btn-secondary">Salvar regra</button></form>)}</div></section>;
};
