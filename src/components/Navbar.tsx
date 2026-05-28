import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { ProfileAvatar } from "./ProfileAvatar";

const handleLogout = async () => {
  await supabase.auth.signOut();
  window.location.href = "/";
};

export const Navbar = () => {
  const [displayName, setDisplayName] = useState("Aluno");
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
      .select("full_name, nickname, avatar_url, avatar_mode, avatar_preset")
      .eq("id", user.id)
      .single();

    if (data?.nickname || data?.full_name) {
      setDisplayName(data.nickname || data.full_name);
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

  const firstName = displayName.split(" ")[0] || "Aluno";

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center rounded-xl px-3 py-2 text-sm font-semibold transition ${
      isActive
        ? "bg-white/10 text-white ring-1 ring-white/15"
        : "text-white/55 hover:bg-white/5 hover:text-white"
    }`;

  const backTarget =
    location.pathname === "/dashboard" ? null : "/dashboard";

  return (
    <nav className="sticky top-0 z-20 border-b border-white/10 bg-brand-900/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          {backTarget && (
            <Link
              to={backTarget}
              className="inline-flex items-center justify-center rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold text-white/75 ring-1 ring-white/15 transition hover:bg-white/10 hover:text-white"
            >
              Voltar
            </Link>
          )}

          <NavLink
            to="/dashboard"
            className="inline-flex items-center gap-3 rounded-2xl text-white transition hover:opacity-90"
          >
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand-purple to-brand-pink text-lg shadow-soft ring-1 ring-white/10">
              <span>R</span>
            </div>

            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-white/45">
                Area do Aluno
              </p>
              <p className="text-base font-bold tracking-tight text-white">
                Escola de Devs
              </p>
            </div>
          </NavLink>
        </div>

        <div className="flex items-center gap-2">
          <NavLink to="/dashboard" className={navClass}>
            Minha jornada
          </NavLink>
          <NavLink to="/minhas-aulas" className={navClass}>
            Minhas aulas
          </NavLink>
          <NavLink to="/meu-boletim" className={navClass}>
            Meu boletim
          </NavLink>
          <NavLink to="/perfil" className={navClass}>
            Meu perfil
          </NavLink>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          <div className="hidden text-right sm:block">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              Conectado como
            </p>
            <p className="text-sm font-bold text-white">{firstName}</p>
          </div>

          <ProfileAvatar
            fullName={displayName}
            avatarMode={avatarMode}
            avatarUrl={avatarUrl}
            avatarPreset={avatarPreset}
            size="md"
          />

          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold text-white/75 ring-1 ring-white/15 transition hover:bg-white/10 hover:text-white"
            type="button"
          >
            Sair
          </button>
        </div>
      </div>
    </nav>
  );
};
