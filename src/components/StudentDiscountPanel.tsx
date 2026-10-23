import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { calculateDiscount,money,currentMonth, discountLabel, type CommercialDiscount, type StudentDiscount } from "../lib/discounts";

export const StudentDiscountPanel = ({ studentId, scope, onChanged, initialMonth,grossByMonth }: {
  studentId: string;
  scope: "recurring" | "monthly";
  onChanged?: () => void;
  initialMonth?: string;
  grossByMonth?:Record<string,number>;
}) => {
  const [month, setMonth] = useState(() => initialMonth || currentMonth());
  const [discountId, setDiscountId] = useState("");
  const [catalog, setCatalog] = useState<CommercialDiscount[]>([]);
  const [rows, setRows] = useState<StudentDiscount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState(false);
  const selectedDiscount=catalog.find(row=>row.id===discountId);
  const gross=grossByMonth?.[month];
  const preview=gross===undefined?null:calculateDiscount(gross,selectedDiscount);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessage("");
    Promise.all([
      supabase.from("commercial_discounts").select("*").eq("is_active", true).order("name"),
      supabase.from("student_discounts").select("*").eq("student_id", studentId).eq("scope", scope)
        .order("effective_month", { ascending: false }),
    ]).then(([options, applied]) => {
      if (cancelled) return;
      setLoadError(Boolean(options.error || applied.error));
      if (options.error || applied.error) setMessage("Não foi possível carregar os descontos. Reabra o painel para tentar novamente.");
      setCatalog(options.data || []);
      setRows(applied.data || []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [studentId, scope]);

  const save = async () => {
    if (saving || loading || loadError) return;
    if (!/^\d{4}-\d{2}$/.test(month)) { setMessage("Selecione um mês válido."); return; }
    setSaving(true);
    setMessage("");
    try {
      const { data, error } = await supabase.from("student_discounts").upsert({
        student_id: studentId, scope, effective_month: `${month}-01`, discount_id: discountId || null,
      }, { onConflict: "student_id,scope,effective_month" }).select("*").single();
      if (error) throw error;
      setRows((previous) => [data, ...previous.filter((row) => row.id !== data.id)]
        .sort((a, b) => b.effective_month.localeCompare(a.effective_month)));
      setMessage(scope === "monthly" ? "Desconto salvo para o mês selecionado." : "Regra contínua salva a partir do mês selecionado.");
      onChanged?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (error as { message?: string })?.message || "Erro ao salvar desconto.");
    } finally { setSaving(false); }
  };

  const removeMonthly = async (row: StudentDiscount) => {
    if (saving) return;
    setSaving(true);
    const { error, data } = await supabase.from("student_discounts").delete().eq("id", row.id).select("id");
    if (error || !data?.length) setMessage("Não foi possível remover o ajuste mensal.");
    else {
      setRows((previous) => previous.filter((item) => item.id !== row.id));
      setMessage("Ajuste mensal removido. O desconto contínuo volta a valer, se houver.");
      onChanged?.();
    }
    setSaving(false);
  };

  return (
    <section className="rounded-2xl bg-brand-900/40 p-4 ring-1 ring-white/10">
      <h3 className="text-lg font-bold">{scope === "recurring" ? "Desconto contínuo do aluno" : "Desconto mensal"}</h3>
      <p className="mt-2 text-sm text-brand-200">
        {scope === "recurring"
          ? "Válido a partir do mês escolhido, até uma nova regra. Para encerrar, salve Sem desconto no mês desejado."
          : "Vale somente para o mês escolhido e substitui o desconto contínuo. Os descontos não se acumulam."}
      </p>
      {loading ? <p className="mt-4 text-sm" role="status">Carregando descontos...</p> : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm">{scope === "recurring" ? "A partir de" : "Mês de referência"}
              <input type="month" className="input" value={month} onChange={(event) => setMonth(event.target.value)} disabled={saving || loadError} />
            </label>
            <label className="grid gap-2 text-sm">Desconto cadastrado
              <select className="input" value={discountId} onChange={(event) => setDiscountId(event.target.value)} disabled={saving || loadError}>
                <option value="">Sem desconto</option>
                {catalog.map((item) => <option key={item.id} value={item.id}>{item.name} — {discountLabel(item)}</option>)}
              </select>
            </label>
          </div>
          {preview&&<section aria-label="Prévia do desconto" aria-live="polite" className="mt-4 space-y-2 rounded-xl bg-surface p-4 text-sm"><p>Valor original: {money(preview.gross)}</p><p>Desconto selecionado: {selectedDiscount?`${selectedDiscount.name} — ${discountLabel(selectedDiscount)}`:'Sem desconto'}</p><p>Valor descontado: {money(preview.discount)}</p><p className="font-bold">Valor final previsto: {money(preview.net)}</p><p>A prévia não altera a cobrança. A confirmação será validada no servidor.</p></section>}
          {grossByMonth&&!preview&&<p className="mt-3 text-sm">Não há base de cálculo neste período para o mês selecionado.</p>}
          <button type="button" className="btn-primary mt-4" onClick={() => void save()} disabled={saving || loadError}>
            {saving ? "Salvando..." : "Aplicar desconto"}
          </button>
          <p className="mt-2 text-xs text-brand-300">Esta ação salva o desconto imediatamente.</p>
          <ul className="mt-4 space-y-2 text-sm">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface p-3">
                <span>{row.effective_month.slice(0, 7).split("-").reverse().join("/")} — {row.name}{row.discount_id ? ` (${discountLabel(row)})` : ""}</span>
                {scope === "monthly" && <button type="button" className="btn-secondary" disabled={saving} onClick={() => void removeMonthly(row)}>Remover ajuste</button>}
              </li>
            ))}
          </ul>
        </>
      )}
      {message && <p className="mt-3 text-sm text-brand-200" role="status">{message}</p>}
    </section>
  );
};
