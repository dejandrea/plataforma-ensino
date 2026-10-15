import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { currentMonth, money } from "../lib/discounts";
import { billingModeLabel, dateLabel, invoiceStatus, nextBillingMonth, todayInBahia, type BillingInvoice, type StudentBilling } from "../lib/billing";

type Package = { id: string; name: string; lesson_quantity: number; package_price: number };
type Mutation = (name: string, args: Record<string, unknown>) => Promise<boolean>;

export const StudentBillingPanel = ({ studentId, onChanged }: { studentId: string; onChanged?: () => void }) => {
  const [data, setData] = useState<StudentBilling | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ mode: "postpaid", month: currentMonth(), dueDay: "5", lessons: "4", price: "", packageId: "" });
  const [topup, setTopup] = useState({ lessons: "1", amount: "", requestId: crypto.randomUUID() });
  const initialized = useRef(false);

  const load = async () => {
    setBusy(true);
    const [billing, catalog] = await Promise.all([
      supabase.rpc("get_student_billing", { p_student_id: studentId }),
      supabase.from("commercial_packages").select("id,name,lesson_quantity,package_price").eq("is_active", true).order("name"),
    ]);
    if (billing.error) setMessage(`Erro ao carregar cobranças: ${billing.error.message}`);
    else {
      const snapshot = billing.data as StudentBilling;
      setData(snapshot);
      if (!initialized.current) {
        const plan = snapshot.plans[0];
        if (plan) setForm({ mode: plan.billing_mode, month: nextBillingMonth(currentMonth()), dueDay: String(plan.due_day), lessons: String(plan.monthly_lessons || 4), price: String(plan.monthly_price), packageId: plan.package_id || "" });
        initialized.current = true;
      }
    }
    if (catalog.error) setMessage(`Não foi possível carregar os pacotes: ${catalog.error.message}`);
    setPackages(catalog.data || []);
    setBusy(false);
  };
  useEffect(() => { void load(); }, [studentId]);

  const mutate: Mutation = async (name, args) => {
    if (busy) return false;
    setBusy(true); setMessage("");
    try {
      const { data: snapshot, error } = await supabase.rpc(name, args);
      if (error) throw error;
      setData(snapshot as StudentBilling);
      setMessage("Registro salvo com sucesso.");
      onChanged?.();
      return true;
    } catch (error) {
      setMessage((error as { message?: string })?.message || "Não foi possível salvar. Tente novamente.");
      return false;
    } finally { setBusy(false); }
  };

  return (
    <section className="space-y-5 rounded-2xl bg-brand-900/40 p-4 ring-1 ring-white/10">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-bold">Cobrança e saldo de aulas</h3><button type="button" className="btn-secondary" disabled={busy} onClick={() => void load()}>Atualizar</button></div>
      {message && <p role="status" className="text-sm text-brand-200">{message}</p>}
      {data ? <>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="card p-3"><p className="text-xs text-brand-200">Tipo atual</p><p className="mt-1 font-bold">{data.plan ? billingModeLabel(data.plan.billing_mode) : "Não configurado"}</p>{data.plan && <p className="mt-1 text-xs text-brand-200">Vencimento: dia {data.plan.due_day}</p>}</div>
          <div className="card p-3"><p className="text-xs text-brand-200">Saldo acumulado</p><p className="mt-1 font-bold">{data.remaining} aula(s)</p></div>
          <div className="card p-3"><p className="text-xs text-brand-200">Novos agendamentos</p><p className="mt-1 font-bold">{data.overdue_blocked ? "Bloqueados por atraso" : data.balance_blocked ? "Sem saldo" : "Liberados"}</p></div>
        </div>
        {data.overage > 0 && <p className="text-sm text-amber-200">Há {data.overage} aula(s) realizadas além do saldo. Uma nova recarga primeiro compensa esse consumo.</p>}
        <p className="text-sm text-brand-200">A renovação acontece no dia 01. O saldo acumula, cada aula concluída consome uma unidade e aulas canceladas não consomem. Atrasos superiores a 15 dias bloqueiam somente novos agendamentos.</p>

        <fieldset disabled={busy} className="space-y-4 rounded-2xl bg-surface p-4">
          <legend className="px-1 font-bold">{data.plans.length ? "Programar nova configuração" : "Configurar cobrança"}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm">Tipo de cobrança<select className="input" value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value })}><option value="postpaid">Pós-pago</option><option value="prepaid">Pré-pago</option></select></label>
            <label className="grid gap-2 text-sm">A partir do mês<input className="input" type="month" min={currentMonth()} value={form.month} onChange={(event) => setForm({ ...form, month: event.target.value })} /></label>
            <label className="grid gap-2 text-sm">Dia de pagamento/cobrança<input className="input" type="number" min="1" max="31" value={form.dueDay} onChange={(event) => setForm({ ...form, dueDay: event.target.value })} /></label>
            {form.mode === "prepaid" && <>
              <label className="grid gap-2 text-sm">Pacote (opcional)<select className="input" value={form.packageId} onChange={(event) => {
                const selected = packages.find((row) => row.id === event.target.value);
                setForm({ ...form, packageId: event.target.value, ...(selected ? { lessons: String(selected.lesson_quantity), price: String(selected.package_price) } : {}) });
              }}><option value="">Personalizado</option>{packages.map((row) => <option value={row.id} key={row.id}>{row.name}</option>)}</select></label>
              <label className="grid gap-2 text-sm">Aulas a renovar por mês<input className="input" type="number" min="1" max="1000" value={form.lessons} onChange={(event) => setForm({ ...form, lessons: event.target.value })} /></label>
              <label className="grid gap-2 text-sm">Valor mensal (R$)<input className="input" type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
            </>}
          </div>
          <p className="text-xs text-brand-300">No pós-pago, o valor usa a hora/aula cadastrada e as aulas concluídas no mês anterior. No pré-pago, a quantidade mensal é renovada no dia 01, com vencimento no dia escolhido. Se o mês não tiver esse dia, o vencimento será no último dia do mês.</p>
          <p className="text-xs text-brand-300">Configurações já faturadas são preservadas. Para mudar o plano, escolha uma competência futura. O salvamento abaixo é independente dos dados pessoais.</p>
          <button type="button" className="btn-primary" onClick={async () => {
            if (!form.month || !Number.isInteger(Number(form.dueDay)) || Number(form.dueDay) < 1 || Number(form.dueDay) > 31 || (form.mode === "prepaid" && (!form.price || !form.lessons))) { setMessage("Preencha o mês, o vencimento e os valores do pré-pago."); return; }
            if (await mutate("save_student_billing_plan", { p_student_id: studentId, p_effective_month: `${form.month}-01`, p_mode: form.mode, p_due_day: Number(form.dueDay), p_monthly_lessons: Number(form.lessons), p_monthly_price: Number(form.price || 0), p_package_id: form.mode === "prepaid" ? form.packageId || null : null })) setForm((previous) => ({ ...previous, month: nextBillingMonth(currentMonth()) }));
          }}>Salvar configuração de cobrança</button>
        </fieldset>

        {data.plans.length > 0 && <ul className="space-y-1 text-xs text-brand-200" aria-label="Histórico das configurações de cobrança">{data.plans.map((plan) => <li key={plan.id}>Desde {plan.effective_month.slice(0, 7).split("-").reverse().join("/")}: {billingModeLabel(plan.billing_mode)} · vencimento dia {plan.due_day}{plan.billing_mode === "prepaid" ? ` · ${plan.monthly_lessons} aulas/mês · ${money(Number(plan.monthly_price))}` : ""}</li>)}</ul>}

        {data.plan?.billing_mode === "prepaid" && <fieldset disabled={busy} className="space-y-3 rounded-2xl bg-surface p-4">
          <legend className="px-1 font-bold">Recarga extra / saldo inicial</legend>
          <p className="text-xs text-brand-300">A recarga libera créditos após o pagamento integral. Para migrar saldo já pago anteriormente, registre a quantidade com valor zero.</p>
          <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2 text-sm">Quantidade de aulas<input className="input" type="number" min="1" max="1000" value={topup.lessons} onChange={(event) => setTopup({ ...topup, lessons: event.target.value })} /></label><label className="grid gap-2 text-sm">Valor da recarga (R$)<input className="input" type="number" min="0" step="0.01" value={topup.amount} onChange={(event) => setTopup({ ...topup, amount: event.target.value })} /></label></div>
          <button type="button" className="btn-secondary" onClick={async () => {
            if (!topup.amount || !topup.lessons) { setMessage("Informe quantidade e valor da recarga."); return; }
            if (await mutate("add_student_topup", { p_student_id: studentId, p_quantity: Number(topup.lessons), p_amount: Number(topup.amount), p_request_id: topup.requestId })) setTopup({ lessons: "1", amount: "", requestId: crypto.randomUUID() });
          }}>Registrar recarga</button>
        </fieldset>}

        <div className="space-y-4"><h4 className="font-bold">Cobranças e pagamentos</h4>
          {data.invoices.length === 0 && <p className="text-sm text-brand-200">Nenhuma cobrança gerada. Configurações futuras entram em vigor no dia 01.</p>}
          {data.invoices.map((invoice) => <div key={invoice.id} className="space-y-3 rounded-2xl bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-bold">{invoice.kind === "topup" ? `Recarga de ${invoice.lesson_quantity} aulas` : `Competência ${invoice.reference_month.slice(0, 7).split("-").reverse().join("/")}`} · {billingModeLabel(invoice.billing_mode)}</p><span className="text-sm text-brand-ice">{invoiceStatus(invoice)}</span></div>
            <div className="grid gap-2 text-sm sm:grid-cols-2"><p>Vencimento: {dateLabel(invoice.due_date)}</p><p>Valor bruto: {money(Number(invoice.gross_amount))}</p><p>Descontos: {money(Number(invoice.discount_amount))}</p><p>Pago: {money(Number(invoice.paid_total))}</p><p className="font-bold">Em aberto: {money(Number(invoice.outstanding))}</p><p>Último pagamento: {dateLabel(invoice.last_paid_on)}</p></div>
            <InvoiceActions key={`${invoice.id}:${invoice.outstanding}:${invoice.due_date}`} invoice={invoice} busy={busy} mutate={mutate} />
            {data.payments.filter((payment) => payment.invoice_id === invoice.id).map((payment) => <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-xs text-brand-200" key={payment.id}>
              <span>{dateLabel(payment.paid_on)} · {money(Number(payment.amount))}{payment.voided_at ? " · Estornado" : " · Pagamento registrado"}</span>
              {!payment.voided_at && <button type="button" className="btn-secondary" disabled={busy} onClick={() => void mutate("void_student_payment", { p_payment_id: payment.id })}>Estornar registro</button>}
            </div>)}
          </div>)}
        </div>
      </> : <p className="text-sm text-brand-200">{busy ? "Carregando cobrança..." : "Use Atualizar para tentar novamente."}</p>}
    </section>
  );
};

const InvoiceActions = ({ invoice, busy, mutate }: { invoice: BillingInvoice; busy: boolean; mutate: Mutation }) => {
  const [amount, setAmount] = useState(String(invoice.outstanding));
  const [paidOn, setPaidOn] = useState(todayInBahia);
  const [dueDate, setDueDate] = useState(invoice.due_date);
  const [requestId] = useState(() => crypto.randomUUID());
  return <fieldset disabled={busy} className="space-y-3 border-t border-white/10 pt-3">
    <div className="flex flex-wrap items-end gap-3"><label className="grid gap-1 text-xs">Vencimento desta cobrança<input className="input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><button type="button" className="btn-secondary" onClick={() => void mutate("change_student_invoice_due_date", { p_invoice_id: invoice.id, p_due_date: dueDate || null })}>Alterar vencimento</button></div>
    {!invoice.is_draft && !invoice.pricing_missing && Number(invoice.outstanding) > 0 && <div className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-xs">Valor recebido (R$)<input className="input" type="number" min="0.01" max={invoice.outstanding} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      <label className="grid gap-1 text-xs">Data real do pagamento<input className="input" type="date" max={todayInBahia()} value={paidOn} onChange={(event) => setPaidOn(event.target.value)} /></label>
      <button type="button" className="btn-primary" onClick={() => void mutate("record_student_payment", { p_invoice_id: invoice.id, p_amount: Number(amount), p_paid_on: paidOn || null, p_request_id: requestId })}>Registrar pagamento</button>
    </div>}
    {invoice.is_draft && <p className="text-xs text-brand-300">Mês em andamento. O recebimento fica disponível no dia 01 do mês seguinte.</p>}
    {invoice.pricing_missing && <p className="text-xs text-amber-200">Defina a hora/aula no cadastro comercial do aluno e atualize esta tela.</p>}
  </fieldset>;
};
