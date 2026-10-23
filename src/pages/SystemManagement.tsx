import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { TabContent } from "../components/management/TabContent";
import { TabLinks } from "../components/management/TabLinks";
import { TabUsers } from "../components/management/TabUsers";


const managementTabs = [
  { id: "users", label: "Usuários" },
  { id: "content", label: "Conteúdo Curricular" },
  { id: "links", label: "Vínculos" },

] as const;

export const SystemManagement = () => {
  const [tab, setTab] = useState<typeof managementTabs[number]["id"]>("users");
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    async function checkUserRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        setUserRole(data?.role || null);
      }
    }
    checkUserRole();
  }, []);

  return (
    <div className="app-bg min-h-screen text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* HEADER SIMPLIFICADO */}
        <header className="mb-8 flex justify-between items-center bg-surface p-6 rounded-3xl ring-1 ring-white/10 backdrop-blur">
          <h1 className="text-3xl font-extrabold italic italic">Torre de Controle 🏗️</h1>
          <span className="text-xs font-bold text-white/40 uppercase tracking-widest">
            {userRole === "admin" ? "Modo Administrador" : "Acesso Negado"}
          </span>
        </header>

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="mb-8 flex flex-wrap gap-x-8 gap-y-3 border-b border-white/10">
          {managementTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`pb-4 text-sm font-bold transition-all ${
                tab === t.id ? "border-b-2 border-brand-pink text-white" : "text-white/40 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* RENDERIZAÇÃO CONDICIONAL DOS COMPONENTES */}
        <div className="animate-in fade-in duration-500">
          {tab === "users" && <TabUsers />}
          {tab === "content" && <TabContent />}
          {tab === "links" && <TabLinks />}

        </div>
      </div>
    </div>
  );
};
