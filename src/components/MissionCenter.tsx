import {CatalogIcon} from './CatalogIcon';
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";

import {IconPicker} from "./IconPicker";

type Technology = { id: string; name: string };
type Badge = { code: string; title: string; is_custom: boolean };
type Mission = { id: string; title: string; description: string; category: string; xp: number; technology_ids: string[]; achievement_codes: string[]; is_final_project: boolean; is_active: boolean;icon:string };
const categories: Record<string, string> = { practice: "Prática", debugging: "Depuração", logic: "Lógica", project: "Projeto" };
const blank = { title: "", description: "", category: "practice", xp: 10, technology_ids: [] as string[], achievement_codes: [] as string[], is_final_project: false, is_active: true,icon:"🎯" };
const inputClass = "mt-2 w-full rounded-xl bg-background px-3 py-2 text-white ring-1 ring-white/20";

export const MissionCenter = ({ admin = false, catalogVersion = 0 }: { admin?: boolean; catalogVersion?: number }) => {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [technologies, setTechnologies] = useState<Technology[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [uploading,setUploading]=useState(false);
  const [draft, setDraft] = useState(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deliveryId, setDeliveryId] = useState<string | null>(null);
  const [workUrl, setWorkUrl] = useState("");
  const [note, setNote] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const [catalog, tech, badgeResult, history] = await Promise.all([
          supabase.from("missions").select("*").order("title"),
          supabase.from("technologies").select("id,name").order("name"),
          supabase.from("achievement_definitions").select("code,title,is_custom").order("title"),
          admin ? Promise.resolve({ data: [], error: null }) : supabase.from("mission_submissions").select("mission_id").eq("student_id", user.id).eq("status", "approved"),
        ]);
        if (catalog.error || tech.error || badgeResult.error || history.error) throw new Error("load");
        if (!cancelled) { setMissions(catalog.data || []); setTechnologies(tech.data || []); setBadges(badgeResult.data || []); setCompleted((history.data || []).map(row => row.mission_id)); }
      } catch { if (!cancelled) setMessage("Não foi possível carregar as missões."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [admin, refresh, catalogVersion]);

  const saveMission = async (event: FormEvent) => {
    event.preventDefault();
    if (busy||uploading) return;
    if (!draft.technology_ids.length || !Number.isInteger(draft.xp) || draft.xp < 0 || draft.xp > 10000) { setMessage("Selecione uma tecnologia e informe XP inteiro entre 0 e 10.000."); return; }
    setBusy(true); setMessage("");
    const payload = { ...draft, title: draft.title.trim(), is_final_project: draft.category === "project" && draft.is_final_project };
    const result = editingId ? await supabase.from("missions").update(payload).eq("id", editingId).select("id").single() : await supabase.from("missions").insert(payload).select("id").single();
    setBusy(false);
    if (result.error) { setMessage("Não foi possível salvar a missão. Confira os campos."); return; }
    setDraft(blank); setEditingId(null); setMessage("Missão salva. Alterações valem para novas conclusões."); setRefresh(value => value + 1);
  };
  const complete = async (event: FormEvent) => {
    event.preventDefault(); if (busy || !deliveryId) return; setBusy(true); setMessage("");
    const { error } = await supabase.rpc("complete_mission", { p_mission_id: deliveryId, p_work_url: workUrl, p_note: note });
    setBusy(false);
    if (error) { setMessage("Não foi possível concluir a missão. Use um link HTTP ou HTTPS válido e tente novamente."); return; }
    setDeliveryId(null); setWorkUrl(""); setNote(""); setMessage("Missão concluída! Seu XP e suas medalhas foram atualizados automaticamente.");
    setRefresh(value => value + 1); window.dispatchEvent(new Event("gamification-updated"));
  };
  return (
    <section className="mt-8 rounded-3xl bg-surface p-6 ring-1 ring-white/10">
      <h2 className="text-2xl font-bold text-white">{admin ? "Cadastro de missões" : "Minhas missões"}</h2>
      <p className="mt-2 text-sm leading-6 text-white/60">{admin ? "Configure XP, tecnologias e conquistas. As conclusões são automáticas, sem aprovação da professora." : "Escolha uma missão, faça a atividade e registre o link da sua entrega. O XP e as medalhas são liberados automaticamente."}</p>
      {message && <p className="mt-4 text-sm text-brand-ice" role="status">{message}</p>}
      {admin && <details className="mt-5" open={editingId ? true : undefined}>
        <summary className="cursor-pointer py-2 font-bold text-brand-lavender">{editingId ? "Editar missão" : "Nova missão"}</summary>
        <form onSubmit={saveMission} className="mt-4 space-y-4"><IconPicker disabled={busy||uploading} onBusyChange={setUploading} value={draft.icon} onChange={icon=>setDraft({...draft,icon})}/>
          <label className="block text-sm text-white/75">Título<input required maxLength={180} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} className={inputClass} /></label>
          <label className="block text-sm text-white/75">Instruções<textarea required value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} className={inputClass} rows={3} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-white/75">Categoria<select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value, is_final_project: false })} className={inputClass}>{Object.entries(categories).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="text-sm text-white/75">XP da missão<input type="number" min={0} max={10000} step={1} required value={Number.isNaN(draft.xp) ? "" : draft.xp} onChange={e => setDraft({ ...draft, xp: e.target.valueAsNumber })} className={inputClass} /></label>
          </div>
          <fieldset><legend className="text-sm font-semibold text-white">Tecnologias envolvidas</legend><div className="mt-3 flex flex-wrap gap-4">{technologies.map(tech => <label key={tech.id} className="flex items-center gap-2 text-sm text-white/75"><input type="checkbox" checked={draft.technology_ids.includes(tech.id)} onChange={e => setDraft({ ...draft, technology_ids: e.target.checked ? [...draft.technology_ids, tech.id] : draft.technology_ids.filter(id => id !== tech.id) })} />{tech.name}</label>)}</div><p className="mt-2 text-xs text-white/50">O XP será dividido igualmente entre as tecnologias selecionadas.</p></fieldset>
          <fieldset><legend className="text-sm font-semibold text-white">Conquistas ao concluir</legend><div className="mt-3 flex flex-wrap gap-4">{badges.filter(badge => badge.is_custom).map(badge => <label key={badge.code} className="flex items-center gap-2 text-sm text-white/75"><input type="checkbox" checked={draft.achievement_codes.includes(badge.code)} onChange={e => setDraft({ ...draft, achievement_codes: e.target.checked ? [...draft.achievement_codes, badge.code] : draft.achievement_codes.filter(code => code !== badge.code) })} />{badge.title}</label>)}</div><p className="mt-2 text-xs text-white/50">As medalhas oficiais são mantidas na área Conquistas. As conquistas de comportamento são calculadas automaticamente.</p></fieldset>
          {draft.category === "project" && <label className="flex items-center gap-2 text-sm text-white/75"><input type="checkbox" checked={draft.is_final_project} onChange={e => setDraft({ ...draft, is_final_project: e.target.checked })} />Projeto final: conta para a medalha de Ouro nas tecnologias selecionadas</label>}
          <label className="flex items-center gap-2 text-sm text-white/75"><input type="checkbox" checked={draft.is_active} onChange={e => setDraft({ ...draft, is_active: e.target.checked })} />Missão disponível para os alunos</label>
          <div className="flex gap-3"><button type="submit" disabled={busy||uploading} className="btn-primary">{busy ? "Salvando..." : "Salvar missão"}</button>{editingId && <button type="button" className="btn-secondary" onClick={() => { setEditingId(null); setDraft(blank); }}>Cancelar edição</button>}</div>
        </form>
      </details>}
      {loading ? <p className="mt-5 text-white/60">Carregando missões...</p> : <div className="mt-5 grid gap-4 md:grid-cols-2">{missions.length === 0 && <p className="text-sm text-white/60">Nenhuma missão disponível ainda.</p>}{missions.map(mission => <article key={mission.id} className="min-w-0 rounded-2xl bg-background p-5 ring-1 ring-white/10">
        <div className="flex items-start justify-between gap-3"><h3 className="font-bold text-white"><CatalogIcon value={mission.icon}/> {mission.title}</h3><span className="shrink-0 text-sm font-bold text-brand-ice">{mission.xp} XP</span></div>
        <p className="mt-2 text-xs text-brand-lavender">{categories[mission.category]} · {technologies.filter(t => mission.technology_ids.includes(t.id)).map(t => t.name).join(", ")}</p>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-white/70">{mission.description}</p>
        {mission.is_final_project && <p className="mt-2 text-xs text-amber-300">Projeto final para maestria Ouro</p>}
        {mission.achievement_codes.length > 0 && <p className="mt-2 text-xs text-brand-pink">🏅 {badges.filter(b => mission.achievement_codes.includes(b.code)).map(b => b.title).join(", ")}</p>}
        {admin ? <button type="button" className="btn-secondary mt-4" onClick={() => { setDraft({ ...mission }); setEditingId(mission.id); }}>{mission.is_active ? "Editar missão" : "Editar missão inativa"}</button> : completed.includes(mission.id) ? <p className="mt-4 font-semibold text-brand-ice">✓ Missão concluída</p> : <button type="button" className="btn-primary mt-4" onClick={() => { setDeliveryId(mission.id); setWorkUrl(""); setNote(""); }}>Registrar conclusão</button>}
        {!admin && deliveryId === mission.id && <form onSubmit={complete} className="mt-4 space-y-3"><label className="block text-sm text-white/75">Link da entrega<input type="url" required value={workUrl} onChange={e => setWorkUrl(e.target.value)} className={inputClass} placeholder="https://..." /></label><label className="block text-sm text-white/75">O que você criou?<textarea value={note} onChange={e => setNote(e.target.value)} className={inputClass} /></label><div className="flex flex-wrap gap-2"><button disabled={busy||uploading} type="submit" className="btn-primary">{busy ? "Concluindo..." : "Concluir missão"}</button><button type="button" className="btn-secondary" onClick={() => setDeliveryId(null)}>Cancelar</button></div></form>}
      </article>)}</div>}
    </section>
  );
};
