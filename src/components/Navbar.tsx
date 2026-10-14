import { BrandLogo } from "./BrandLogo";
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
  const [hasCourseAccess, setHasCourseAccess] = useState(true);
  const location = useLocation();

  const loadProfile = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    let profileQuery = await supabase
      .from("profiles")
      .select("full_name, nickname, avatar_url, avatar_mode, avatar_preset, student_service_scope")
      .eq("id", user.id)
      .single();

    if (profileQuery.error?.message?.includes("student_service_scope")) {
      profileQuery = await supabase
        .from("profiles")
        .select("full_name, nickname, avatar_url, avatar_mode, avatar_preset")
        .eq("id", user.id)
        .single();
    }

    const data = profileQuery.data;

    if (data?.nickname || data?.full_name) {
      setDisplayName(data.nickname || data.full_name);
    }

    setAvatarUrl(data?.avatar_url || "");
    setAvatarMode(data?.avatar_mode || "preset");
    setAvatarPreset(data?.avatar_preset || "avatar-1");
    setHasCourseAccess(
      data?.student_service_scope === "course" || data?.student_service_scope === "both",
    );
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
        ? "bg-surface-elevated text-white ring-1 ring-white/15"
        : "text-white/55 hover:bg-surface hover:text-white"
    }`;

  const studentHome = hasCourseAccess ? "/dashboard" : "/minhas-aulas";
  const backTarget = location.pathname === studentHome ? null : studentHome;

  return (
    <nav className="sticky top-0 z-20 border-b border-white/10 bg-brand-900/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-h-[108px] shrink-0 flex-col items-start gap-2">
          <NavLink
            to={studentHome}
            className="inline-flex items-center gap-3 rounded-2xl text-white transition hover:opacity-90"
          >
            <BrandLogo />
          </NavLink>

          {backTarget && (
            <Link
              to={backTarget}
              className="inline-flex h-8 w-11 items-center justify-center rounded-lg bg-surface text-xs font-semibold text-white/75 ring-1 ring-white/15 transition hover:bg-surface-elevated hover:text-white"
            >
              Voltar
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasCourseAccess && (
            <NavLink to="/dashboard" className={navClass}>
              Minha jornada
            </NavLink>
          )}
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
            <p className="mb-2 text-sm font-black uppercase tracking-[0.2em] text-white/45">
              Área do Aluno
            </p>
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
            className="inline-flex items-center justify-center rounded-xl bg-surface px-3 py-2 text-sm font-semibold text-white/75 ring-1 ring-white/15 transition hover:bg-surface-elevated hover:text-white"
            type="button"
          >
            Sair
          </button>
        </div>
      </div>
    </nav>
  );
};
