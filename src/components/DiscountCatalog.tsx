import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { discountLabel, type CommercialDiscount, type DiscountKind } from "../lib/discounts";

const emptyForm = { id: "", name: "", kind: "percentage" as DiscountKind, value: "", is_active: true };

export const DiscountCatalog = () => {
  const [rows, setRows] = useState<CommercialDiscount[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    const { data, error } = await supabase.from("commercial_discounts").select("*").order("name");
    if (error) setMessage(`Erro ao carregar descontos: ${error.message}`);
    else setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const value = Number(form.value);
    if (!form.name.trim() || !Number.isFinite(value) || value <= 0 || (form.kind === "percentage" && value > 100)) {
      setMessage("Informe um nome e um valor positivo. O percentual deve ser de até 100%."); return;
    }
    setSaving(true);
    const payload = { name: form.name.trim(), kind: form.kind, value, is_active: form.is_active };
    const result = form.id
      ? await supabase.from("commercial_discounts").update(payload).eq("id", form.id).select("id").single()
      : await supabase.from("commercial_discounts").insert(payload).select("id").single();
    if (result.error) setMessage(`Erro ao salvar: ${result.error.message}`);
    else { setForm(emptyForm); setMessage("Desconto salvo. As aplicações existentes mantêm os valores originais."); await load(); }
    setSaving(false);
  };

  return (
    <section className="mt-8 grid gap-6 lg:grid-cols-2">
      <div className="card p-6">
        <h2>Descontos cadastrados</h2>
        <p className="mt-2 text-sm text-brand-200">Cadastre percentuais ou valores fixos em reais por mês.</p>
        {loading ? <p className="mt-4">Carregando...</p> : rows.length === 0 ? <p className="mt-4 text-brand-300">Nenhum desconto cadastrado.</p> : (
          <ul className="mt-5 space-y-3">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background p-4">
                <div><h3 className="font-bold">{row.name}</h3><p className="text-sm text-brand-200">{discountLabel(row)} · {row.is_active ? "Ativo" : "Inativo"}</p></div>
                <button type="button" className="btn-secondary" disabled={saving} onClick={() => setForm({ ...row, value: String(row.value) })}>Editar</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <form onSubmit={save} className="card space-y-4 p-6">
        <h2>{form.id ? "Editar desconto" : "Novo desconto"}</h2>
        <label className="grid gap-2 text-sm">Nome<input className="input" required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label className="grid gap-2 text-sm">Tipo<select className="input" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as DiscountKind })}><option value="percentage">Percentual (%)</option><option value="fixed">Valor fixo (R$ por mês)</option></select></label>
        <label className="grid gap-2 text-sm">{form.kind === "percentage" ? "Percentual" : "Valor em reais"}<input className="input" required type="number" min="0.01" max={form.kind === "percentage" ? "100" : "99999999.99"} step="0.01" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />Disponível para novas aplicações</label>
        <p className="text-xs text-brand-300">Inativar impede novas aplicações e mantém o histórico dos alunos.</p>
        <div className="flex flex-wrap gap-3"><button className="btn-primary" disabled={saving}>{saving ? "Salvando..." : "Salvar desconto"}</button><button type="button" className="btn-secondary" disabled={saving} onClick={() => setForm(emptyForm)}>Limpar</button></div>
        {message && <p className="text-sm text-brand-200" role="status">{message}</p>}
      </form>
    </section>
  );
};
