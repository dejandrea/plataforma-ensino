import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { billingModeLabel, dateLabel, type StudentBilling } from "../lib/billing";
import { currentMonth, money } from "../lib/discounts";

export const StudentBillingSummary = () => {
  const [data, setData] = useState<StudentBilling | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const result = await supabase.rpc("get_student_billing");
      if (cancelled) return;
      setError(result.error ? "Não foi possível atualizar o saldo de aulas." : "");
      if (!result.error) setData(result.data as StudentBilling);
    };
    void load();
    const interval = window.setInterval(() => { if (!document.hidden) void load(); }, 60_000);
    window.addEventListener("focus", load);
    return () => { cancelled = true; window.clearInterval(interval); window.removeEventListener("focus", load); };
  }, []);
  if (error) return <p role="status" className="mx-auto mt-4 max-w-6xl px-4 text-sm text-brand-200">{error}</p>;
  if (!data?.plan) return null;
  const current = data.invoices.find((row) => row.kind === "monthly" && row.reference_month.slice(0, 7) === currentMonth());
  const lastPayment = data.payments.filter((row) => !row.voided_at).sort((a, b) => b.paid_on.localeCompare(a.paid_on))[0];
  return (
    <section className="mx-auto mt-6 max-w-6xl px-4" aria-label="Meu pacote e pagamentos">
      <div className="card flex flex-wrap items-start justify-between gap-5 p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-200">Minha cobrança · {billingModeLabel(data.plan.billing_mode)}</p>
          {data.plan.billing_mode === "prepaid" ? <><p className="mt-2 font-heading text-3xl font-bold text-brand-ice">{data.remaining} aula(s) restantes</p><p className="mt-2 text-sm text-brand-200">+{data.plan.monthly_lessons} aulas a cada dia 01. O saldo não utilizado acumula.</p></>
            : <p className="mt-2 text-sm text-brand-200">As aulas realizadas no mês são cobradas no mês seguinte.</p>}
          {data.overage > 0 && <p className="mt-2 text-sm text-amber-200">{data.overage} aula(s) realizadas aguardam reposição de créditos. Fale com a gestão.</p>}
        </div>
        <div className="space-y-1 text-sm text-brand-200">
          <p>Dia de cobrança: {data.plan.due_day}</p>
          {current && <p>Vencimento: {dateLabel(current.due_date)} · {money(Number(current.outstanding))} em aberto{current.is_draft ? " (em apuração)" : ""}</p>}
          <p>Último pagamento: {dateLabel(lastPayment?.paid_on)}</p>
        </div>
        {data.overdue_blocked && <p className="w-full text-sm text-rose-300" role="status">Novos agendamentos estão bloqueados por atraso superior a 15 dias. Os conteúdos e as aulas já agendadas continuam disponíveis. Procure a gestão para regularizar.</p>}
        {!data.overdue_blocked && data.balance_blocked && <p className="w-full text-sm text-amber-200">Seu saldo esgotou. Solicite uma recarga para fazer novos agendamentos.</p>}
      </div>
    </section>
  );
};
