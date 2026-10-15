import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { currentMonth, money } from "../lib/discounts";
import { dateLabel, invoiceStatus, type BillingInvoice } from "../lib/billing";
import { StudentBillingPanel } from "./StudentBillingPanel";
import { useSearchParams } from "react-router-dom";

export const BillingManagement = () => {
  const [searchParams] = useSearchParams();
  const [month, setMonth] = useState(currentMonth);
  const [students, setStudents] = useState<{ id: string; full_name: string }[]>([]);
  const [rows, setRows] = useState<BillingInvoice[]>([]);
  const [selected, setSelected] = useState(() => searchParams.get("studentId") || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    const result = await supabase.rpc("get_billing_management", { p_due_month: `${month}-01` });
    setError(result.error ? `Não foi possível atualizar as cobranças: ${result.error.message}` : "");
    setRows(result.data || []); setLoading(false);
  };
  useEffect(() => { if (month) void load(); }, [month]);
  useEffect(() => {
    void supabase.from("profiles").select("id,full_name").eq("role", "student").order("full_name").then(({ data, error }) => {
      setStudents(data || []);
      if (error) setError(`Não foi possível carregar os alunos: ${error.message}`);
    });
  }, []);
  return <section className="mt-8 space-y-6">
    <div className="card space-y-4 p-6">
      <h2>Controle de cobranças e pagamentos</h2>
      <p className="text-sm text-brand-200">Renovação todo dia 01, vencimento individual e saldo pré-pago acumulativo. Configure cada aluno para iniciar a geração automática de cobranças.</p>
      <div className="flex flex-wrap items-end gap-3"><label className="grid gap-2 text-sm">Vencimentos em<input type="month" className="input" value={month} onChange={(event) => setMonth(event.target.value)} /></label><button type="button" className="btn-secondary" disabled={loading || !month} onClick={() => void load()}>Atualizar cobranças</button></div>
      {error && <p className="text-sm text-rose-300" role="alert">{error}</p>}
      {!error && <p className="text-sm text-brand-200">{rows.length} cobrança(s) · Em aberto: {money(rows.filter((row) => !row.is_draft).reduce((sum, row) => sum + Number(row.outstanding), 0))}</p>}
      {loading ? <p role="status">Atualizando...</p> : !error && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-brand-200"><tr><th className="p-3">Aluno</th><th className="p-3">Vencimento</th><th className="p-3">Situação</th><th className="p-3">Em aberto</th><th className="p-3">Ações</th></tr></thead><tbody>
        {rows.map((row) => <tr className="border-t border-white/10" key={row.id}><td className="p-3">{row.student_name}<span className="block text-xs text-brand-300">{row.kind === "topup" ? "Recarga extra" : `Competência ${row.reference_month.slice(0, 7).split("-").reverse().join("/")}`}</span></td><td className="p-3">{dateLabel(row.due_date)}</td><td className="p-3">{invoiceStatus(row)}</td><td className="p-3">{money(Number(row.outstanding))}</td><td className="p-3"><button type="button" className="btn-secondary" onClick={() => setSelected(row.student_id)}>Gerenciar</button></td></tr>)}
        {rows.length === 0 && <tr><td className="p-4 text-brand-300" colSpan={5}>Nenhuma cobrança com vencimento neste mês.</td></tr>}
      </tbody></table></div>}
    </div>
    <div className="card space-y-4 p-6"><label className="grid gap-2 text-sm font-bold">Gerenciar aluno<select className="input" value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Selecione um aluno</option>{students.map((row) => <option key={row.id} value={row.id}>{row.full_name}</option>)}</select></label>
      {selected && <StudentBillingPanel key={selected} studentId={selected} onChanged={() => void load()} />}
    </div>
  </section>;
};
