import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { TabContent } from "../components/management/TabContent";
import { TabLinks } from "../components/management/TabLinks";
import { TabUsers } from "../components/management/TabUsers";

export const SystemManagement = () => {
  const [tab, setTab] = useState<"users" | "content" | "links">("users");
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
        <header className="mb-8 flex justify-between items-center bg-white/5 p-6 rounded-3xl ring-1 ring-white/10 backdrop-blur">
          <h1 className="text-3xl font-extrabold italic italic">Torre de Controle 🏗️</h1>
          <span className="text-xs font-bold text-white/40 uppercase tracking-widest">
            {userRole === "admin" ? "Modo Administrador" : "Acesso Negado"}
          </span>
        </header>

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="mb-8 flex gap-8 border-b border-white/10">
          {["users", "content", "links"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t as any)}
              className={`pb-4 text-sm font-bold transition-all ${
                tab === t ? "border-b-2 border-brand-pink text-white" : "text-white/40 hover:text-white"
              }`}
            >
              {t === "users" ? "Usuários" : t === "content" ? "Conteúdo Curricular" : "Vínculos"}
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
