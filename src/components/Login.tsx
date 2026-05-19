import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

export const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Função para descobrir o papel (role) e navegar para a rota certa
  const redirectUser = async (userId: string) => {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (error || !profile) {
      console.error("Erro ao buscar perfil:", error);
      alert("Erro ao identificar seu perfil. Entre em contato com o suporte.");
      return;
    }

    if (profile.role === "admin" || profile.role === "professor") {
      navigate("/dashboard-professor");
    } else {
      navigate("/dashboard");
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      setLoading(false);
    } else if (data.user) {
      // Login sucesso! Agora vamos ver para onde ele vai
      await redirectUser(data.user.id);
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setLoading(true);

    // 1. Verifica se o e-mail está na nossa "lista de permitidos" (profiles)
    const { data: allowed, error: checkError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("email", email)
      .single();

    if (checkError || !allowed) {
      alert(
        "Este e-mail não está autorizado. Entre em contato com a professora.",
      );
      setLoading(false);
      return;
    }

    // 2. Se o e-mail existe, agora sim ele pode criar a senha no Auth
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) alert(signUpError.message);
    else alert("Conta vinculada! Agora você pode entrar com sua senha.");

    setLoading(false);
  };

return (
  <div className="relative min-h-screen overflow-hidden bg-brand-900 font-sans text-brand-50">
    {/* Glow / background decor */}
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-pink/20 blur-3xl" />
      <div className="absolute -bottom-24 right-10 h-72 w-72 rounded-full bg-brand-lavender/20 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(128,112,205,0.12),transparent_55%)]" />
    </div>

    <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="rounded-3xl bg-white/5 p-7 shadow-soft ring-1 ring-white/10 backdrop-blur md:p-8">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-purple to-brand-pink shadow-soft ring-1 ring-white/10">
              <span className="text-2xl">🚀</span>
            </div>

            <h2 className="mt-5 text-3xl font-extrabold tracking-tight">
              Escola de Devs
            </h2>
            <p className="mt-2 text-sm text-white/65">
              Sua jornada tech começa aqui.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSignIn} className="mt-7 space-y-4">
            <div>
              <label className="ml-1 text-xs font-semibold uppercase tracking-wide text-white/60">
                E-mail
              </label>
              <input
                type="email"
                placeholder="exemplo@email.com"
                className="mt-2 w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 placeholder:text-white/35 outline-none transition focus:ring-2 focus:ring-brand-lavender"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="ml-1 text-xs font-semibold uppercase tracking-wide text-white/60">
                Senha
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="mt-2 w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 placeholder:text-white/35 outline-none transition focus:ring-2 focus:ring-brand-lavender"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-magenta to-brand-pink px-4 py-3 text-sm font-bold text-white shadow-soft ring-1 ring-white/10 transition hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                  Verificando...
                </>
              ) : (
                "Entrar na Plataforma"
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-7 border-t border-white/10 pt-6 text-center">
            <button
              onClick={handleSignUp}
              className="text-sm font-semibold text-brand-lavender transition hover:text-brand-pink"
              type="button"
            >
              Sou aluno novo e quero me cadastrar
            </button>
          </div>
        </div>

        {/* Small note */}
        <p className="mt-5 text-center text-xs text-white/45">
          Ao entrar, você concorda com os termos da plataforma.
        </p>
      </div>
    </div>
  </div>
);
};
