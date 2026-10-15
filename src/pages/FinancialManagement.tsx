import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { BillingManagement } from "../components/BillingManagement";
import { TeacherReports } from "./TeacherReports";

export const FinancialManagement = () => {
  const [params, setParams] = useSearchParams();
  const [role, setRole] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) setError("Sessão não encontrada. Entre novamente."); return; }
      const result = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (cancelled) return;
      if (result.error) setError("Não foi possível carregar as permissões do financeiro.");
      else setRole(result.data.role);
    })();
    return () => { cancelled = true; };
  }, []);
  const tab = params.get("tab") === "billing" && role === "admin" ? "billing" : "summary";
  const changeTab = (value: string) => setParams((current) => {
    const next = new URLSearchParams(current);
    next.set("tab", value);
    return next;
  });
  return <div className="app-bg">
    <div className="mx-auto max-w-6xl px-4 pt-8">
      <header className="card p-6 md:p-8">
        <h1>Financeiro</h1>
        <p className="mt-3 text-sm text-brand-200">Acompanhe os valores das aulas, as cobranças e os pagamentos.</p>
        <div className="mt-5 flex flex-wrap gap-2" aria-label="Seções do financeiro">
          <button type="button" className={tab === "summary" ? "btn-primary" : "btn-secondary"} onClick={() => changeTab("summary")}>Resumo financeiro</button>
          {role === "admin" && <button type="button" className={tab === "billing" ? "btn-primary" : "btn-secondary"} onClick={() => changeTab("billing")}>Cobranças</button>}
        </div>
      </header>
    </div>
    {error ? <p role="alert" className="mx-auto max-w-6xl p-6 text-rose-300">{error}</p>
      : !role ? <p role="status" className="mx-auto max-w-6xl p-6">Carregando financeiro...</p>
        : tab === "billing" ? <div className="mx-auto max-w-6xl px-4 pb-8"><BillingManagement /></div>
          : <TeacherReports financialOnly />}
  </div>;
};
