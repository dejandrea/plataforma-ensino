import {CatalogIcon} from './CatalogIcon';
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";

import {IconPicker} from "./IconPicker";

type Technology = { id: string; slug: string; name: string; bronze_title: string; silver_title: string; gold_title: string; icon:string };
const emptyTechnology = { name: "", bronze_title: "", silver_title: "", gold_title: "",icon:"💻" };
const fields = [
  { id: "name", label: "Nome da tecnologia", placeholder: "Ex.: TypeScript" },
  { id: "bronze_title", label: "Medalha Bronze", placeholder: "Ex.: Explorador de Tipos" },
  { id: "silver_title", label: "Medalha Prata", placeholder: "Ex.: Guardião das Interfaces" },
  { id: "gold_title", label: "Medalha Ouro", placeholder: "Ex.: Mestre do TypeScript" },
] as const;

export const TechnologyCatalog = ({ onSaved }: { onSaved?: () => void }) => {
  const [technologies, setTechnologies] = useState<Technology[]>([]);
  const [draft, setDraft] = useState(emptyTechnology);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading,setUploading]=useState(false);
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void supabase.from("technologies").select("*").order("name").then(({ data, error }) => {
      if (cancelled) return;
      if (error) setMessage("Não foi possível carregar as tecnologias.");
      else setTechnologies(data || []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [refresh]);
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (busy||uploading) return;
    const payload = Object.fromEntries(Object.entries(draft).map(([key,value]) => [key, value.trim()])) as typeof emptyTechnology;
    if (Object.entries(payload).some(([key,value]) => !value || value.length > (key === 'icon' ? 2048 : 100))) {
      setMessage("Preencha todos os nomes, com até 100 caracteres cada."); return;
    }
    setBusy(true); setMessage("");
    const result = editingId
      ? await supabase.from("technologies").update(payload).eq("id", editingId).select("id").single()
      : await supabase.from("technologies").insert({ ...payload, slug: `tech-${crypto.randomUUID()}` }).select("id").single();
    setBusy(false);
    if (result.error) { setMessage(result.error.code === "23505" ? "Já existe uma tecnologia com esse nome." : "Não foi possível salvar a tecnologia."); return; }
    setDraft(emptyTechnology); setEditingId(null); setMessage("Tecnologia salva. Ela já está disponível no cadastro de missões e nas maestrias.");
    setRefresh(value => value + 1); onSaved?.();
  };
  return <section className="mt-8 rounded-3xl bg-surface p-6 ring-1 ring-white/10">
    <h2 className="text-2xl font-bold text-white">Cadastro de tecnologias</h2>
    <p className="mt-2 text-sm leading-6 text-white/60">Cadastre as tecnologias das missões e personalize os nomes de suas medalhas. Editar os nomes mantém os vínculos, o progresso e as conquistas existentes.</p>
    {message && <p className="mt-4 text-sm text-brand-ice" role="status">{message}</p>}
    <form onSubmit={save} className="mt-5 space-y-4">
      <h3 className="font-semibold text-white">{editingId ? "Editar tecnologia" : "Nova tecnologia"}</h3>
      <IconPicker disabled={busy||uploading} onBusyChange={setUploading} value={draft.icon} onChange={icon=>setDraft(current=>({...current,icon}))}/><div className="grid gap-4 sm:grid-cols-2">{fields.map(field => <label key={field.id} className="text-sm text-white/75">{field.label}<input required maxLength={100} disabled={busy||uploading} value={draft[field.id]} onChange={e => setDraft(current => ({ ...current, [field.id]: e.target.value }))} placeholder={field.placeholder} className="mt-2 w-full rounded-xl bg-background px-3 py-2 text-white ring-1 ring-white/20" /></label>)}</div>
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={busy||uploading} className="btn-primary">{busy ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar tecnologia"}</button>{editingId && <button type="button" disabled={busy||uploading} className="btn-secondary" onClick={() => { setEditingId(null); setDraft(emptyTechnology); }}>Cancelar edição</button>}</div>
    </form>
    {loading ? <p className="mt-5 text-white/60">Carregando tecnologias...</p> : <div className="mt-6 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Tecnologias e nomes das medalhas</caption><thead className="text-white/50"><tr><th scope="col" className="p-3">Tecnologia</th><th scope="col" className="p-3">Bronze</th><th scope="col" className="p-3">Prata</th><th scope="col" className="p-3">Ouro</th><th scope="col" className="p-3">Ação</th></tr></thead><tbody>{technologies.map(technology => <tr key={technology.id} className="border-t border-white/10 text-white/75"><th scope="row" className="p-3 font-semibold text-white"><span className="inline-flex items-center gap-2"><CatalogIcon value={technology.icon || emptyTechnology.icon}/><span>{technology.name}</span></span></th><td className="p-3">{technology.bronze_title}</td><td className="p-3">{technology.silver_title}</td><td className="p-3">{technology.gold_title}</td><td className="p-3"><button disabled={busy||uploading} type="button" aria-label={`Editar ${technology.name}`} className="btn-secondary" onClick={() => { setEditingId(technology.id); setDraft({ name: technology.name, bronze_title: technology.bronze_title, silver_title: technology.silver_title, gold_title: technology.gold_title,icon:technology.icon }); setMessage(""); }}>Editar</button></td></tr>)}</tbody></table></div>}
  </section>;
};
