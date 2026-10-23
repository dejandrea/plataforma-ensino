import { BrandLogo } from "./BrandLogo";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { ProfileAvatar } from "./ProfileAvatar";

const handleLogout = async () => {
  await supabase.auth.signOut();
  window.location.href = "/";
};

export const StaffNavbar = () => {
  const [displayName, setDisplayName] = useState("Equipe");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarMode, setAvatarMode] = useState("preset");
  const [avatarPreset, setAvatarPreset] = useState("avatar-1");
  const location = useLocation();

  const loadProfile = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("full_name, nickname, role, avatar_url, avatar_mode, avatar_preset")
      .eq("id", user.id)
      .single();

    if (data?.nickname || data?.full_name) {
      setDisplayName(data.nickname || data.full_name);
    }

    if (data?.role) {
      setUserRole(data.role);
    }

    setAvatarUrl(data?.avatar_url || "");
    setAvatarMode(data?.avatar_mode || "preset");
    setAvatarPreset(data?.avatar_preset || "avatar-1");
  };

  useEffect(() => {
    void loadProfile();

    const refreshProfile = () => {
      void loadProfile();
    };

    window.addEventListener("profile-updated", refreshProfile);

    return () => {
      window.removeEventListener("profile-updated", refreshProfile);
    };
  }, []);

  const firstName = displayName.split(" ")[0] || "Equipe";

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex shrink-0 items-center whitespace-nowrap rounded-xl px-2 py-2 text-xs font-semibold transition sm:px-3 sm:text-sm ${
      isActive
        ? "bg-surface-elevated text-white ring-1 ring-white/15"
        : "text-white/55 hover:bg-surface hover:text-white"
    }`;

  const backTarget = (() => {
    if (location.pathname === "/dashboard-professor") return null;
    if (location.pathname === "/vincular-aluno") return "/gestao";
    return "/dashboard-professor";
  })();

  return (
    <nav className="sticky top-0 z-20 border-b border-white/10 bg-brand-900/85 backdrop-blur-xl">
      <div className="mx-auto grid max-w-6xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2 md:px-4">
        <div className="col-start-1 row-start-1 shrink-0 lg:row-span-2">
          <NavLink
            to="/dashboard-professor"
            className="inline-flex items-center gap-3 rounded-2xl text-white transition hover:opacity-90"
          >
            <BrandLogo compact />
          </NavLink>
        </div>

        <p className="col-start-2 row-start-1 pl-2 text-left text-xs font-black uppercase tracking-[0.12em] text-white/45 sm:pl-3 sm:text-sm">
            {userRole === "admin" ? "Área da Gestão" : "Área da Professora"}
          </p>

        <div className="col-span-3 row-start-2 flex min-w-0 items-center gap-1 overflow-x-auto pb-1 lg:col-span-1 lg:col-start-2">
          <NavLink to="/dashboard-professor" className={navClass}>
            Meus alunos
          </NavLink>
          <NavLink to="/agendamentos" className={navClass}>
            Agenda
          </NavLink>
          <NavLink to="/relatorios" className={navClass}>
            Relatorios
          </NavLink>
          <NavLink to="/financeiro" className={navClass}>
            Financeiro
          </NavLink>
          {userRole === "admin" && (
            <NavLink to="/comercial" className={navClass}>
              Comercial
            </NavLink>
          )}
          <NavLink to="/perfil-profissional" className={navClass}>
            Meu perfil
          </NavLink>
          {userRole === "admin" && (
            <NavLink to="/gestao" className={navClass}>
              Gestao
            </NavLink>
          )}
          {userRole==='admin'&&<NavLink to="/conquistas" className={navClass}>Conquistas</NavLink>}
        </div>

        <div className="col-start-3 row-start-1 flex shrink-0 flex-col items-end gap-2 lg:row-span-2">
          <div className="flex items-center gap-2">
            {backTarget && (
              <Link
                to={backTarget}
                className="inline-flex items-center justify-center rounded-xl bg-surface px-2 py-2 text-xs font-semibold text-white/75 ring-1 ring-white/15 transition hover:bg-surface-elevated hover:text-white"
              >
                Voltar
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="inline-flex items-center justify-center rounded-xl bg-surface px-2 py-2 text-xs font-semibold text-white/75 ring-1 ring-white/15 transition hover:bg-surface-elevated hover:text-white"
              type="button"
            >
              Sair
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right xl:block">

              <p className="text-sm font-bold text-white">{firstName}</p>
            </div>

            <ProfileAvatar
              fullName={displayName}
              avatarMode={avatarMode}
              avatarUrl={avatarUrl}
              avatarPreset={avatarPreset}
              size="sm"
            />
          </div>
        </div>
      </div>
    </nav>
  );
};
