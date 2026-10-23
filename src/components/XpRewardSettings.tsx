import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { evaluationXpRange, xpLabels, type XpRule } from "../lib/xp";

export const XpRewardSettings = () => {
  const [rules, setRules] = useState<XpRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let cancelled = false;
    void supabase.from("xp_reward_rules").select("event_type,points,calculation,is_official").then(({ data, error }) => {
      if (cancelled) return;
      if (error) setMessage("Não foi possível carregar as regras de pontuação.");
      else setRules(data || []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const save = async (rule: XpRule) => {
    if (rule.is_official) return;
    if (saving) return;
    if (!Number.isInteger(rule.points) || rule.points < 0 || rule.points > 10000) {
      setMessage("Informe pontos inteiros entre 0 e 10.000.");
      return;
    }
    setSaving(rule.event_type);
    setMessage("");
    const { data, error } = await supabase.from("xp_reward_rules").update({ points: rule.points })
      .eq("event_type", rule.event_type).select("event_type").single();
    setMessage(error || !data ? "Não foi possível salvar a pontuação." : "Pontuação salva. O novo valor vale para novas conquistas.");
    setSaving(null);
  };
  const range = evaluationXpRange(rules.find(r => r.event_type === "evaluation")?.points || 0,
    rules.find(r => r.event_type === "evaluation_star")?.points || 0);

  return (
    <section className="mt-8 rounded-3xl bg-surface p-6 ring-1 ring-white/10" aria-labelledby="xp-settings-title">
      <h2 id="xp-settings-title" className="text-2xl font-bold text-white">Pontuação das conquistas</h2>
      <p className="mt-3 text-sm leading-6 text-white/65">As regras oficiais v1 são protegidas. Questionários premiam a primeira tentativa pela porcentagem de acerto; projetos recebem créditos separados pelo envio e pela nota. A alteração posterior da nota ajusta o crédito da avaliação.</p>
      <p className="mt-2 text-sm text-white/65">Os demais bônus continuam configuráveis para novas conquistas. Créditos históricos são preservados.</p>
      {message && <p role="status" className="mt-4 text-sm text-brand-ice">{message}</p>}
      {loading ? <p className="mt-4 text-white/60">Carregando pontuação...</p> : rules.length > 0 && <>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Configuração de XP por conquista</caption>
            <thead className="text-white/60"><tr><th scope="col" className="p-3">Conquista</th><th scope="col" className="p-3">Pontos</th><th scope="col" className="p-3">Ação</th></tr></thead>
            <tbody>{Object.keys(xpLabels).filter(key => key !== "opening" && key !== "mission").map(key => {
              const rule = rules.find(r => r.event_type === key);
              if (!rule) return null;
              return <tr key={key} className="border-t border-white/10">
                <th scope="row" className="p-3 font-medium text-white">{xpLabels[key]}</th>
                <td className="p-3">{rule.is_official ? <span className="text-brand-ice">{rule.calculation === 'first_quiz_score' ? '0–100 XP, primeira tentativa' : rule.calculation === 'project_grade' ? '0–100 XP, nota definitiva' : `${rule.points} XP`}</span> : <input type="number" min={0} max={10000} step={1} required aria-label={`Pontos: ${xpLabels[key]}`}
                  value={Number.isNaN(rule.points) ? "" : rule.points} disabled={saving !== null}
                  onChange={e => setRules(current => current.map(r => r.event_type === key ? { ...r, points: e.target.valueAsNumber } : r))}
                  className="w-24 rounded-xl bg-background px-3 py-2 text-white ring-1 ring-white/20" />}</td>
                <td className="p-3">{rule.is_official ? <span className="text-white/60">Regra oficial v1</span> : <button type="button" className="btn-secondary" disabled={saving !== null} onClick={() => void save(rule)}>{saving === key ? "Salvando..." : "Salvar"}</button>}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-brand-ice">Com os valores acima, uma avaliação completa de oito áreas rende de {range.min} a {range.max} XP.</p>
      </>}
    </section>
  );
};
