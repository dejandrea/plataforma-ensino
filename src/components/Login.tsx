import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { ensureUserProfile } from "../lib/ensureUserProfile";

export const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    void supabase.auth.signOut();
  }, []);

  const redirectUser = async (userId: string, userEmail?: string | null) => {
    const profile = await ensureUserProfile(userId, userEmail);

    if (!profile) {
      alert("Erro ao identificar seu perfil. Entre em contato com o suporte.");
      return;
    }

    if (!profile.is_active) {
      await supabase.auth.signOut();
      alert("Seu acesso esta inativo. Entre em contato com a administracao.");
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
    setMessage("");

    await supabase.auth.signOut();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      setLoading(false);
    } else if (data.user) {
      await redirectUser(data.user.id, data.user.email);
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setMessage("Digite seu e-mail antes de pedir o acesso inicial ou a recuperacao.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage(
        "Se o seu acesso ja foi liberado pela administracao, enviamos um link para definir ou redefinir sua senha. Verifique seu e-mail.",
      );
    }

    setLoading(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-brand-900 font-sans text-brand-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-pink/20 blur-3xl" />
        <div className="absolute -bottom-24 right-10 h-72 w-72 rounded-full bg-brand-lavender/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(128,112,205,0.12),transparent_55%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="rounded-3xl bg-white/5 p-7 shadow-soft ring-1 ring-white/10 backdrop-blur md:p-8">
            <div className="text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-purple to-brand-pink shadow-soft ring-1 ring-white/10">
                <span className="text-2xl">🚀</span>
              </div>

              <h2 className="mt-5 text-3xl font-extrabold tracking-tight">
                Escola de Devs
              </h2>
              <p className="mt-2 text-sm text-white/65">
                Sua jornada tech comeca aqui.
              </p>
            </div>

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

            <div className="mt-4 text-center">
              <button
                onClick={handleForgotPassword}
                className="text-sm font-semibold text-white/70 transition hover:text-brand-lavender"
                type="button"
              >
                Primeiro acesso ou esqueci minha senha
              </button>
            </div>

            {message && (
              <div className="mt-4 rounded-2xl bg-white/5 p-4 text-sm text-white/80 ring-1 ring-white/10">
                {message}
              </div>
            )}

            <div className="mt-7 border-t border-white/10 pt-6 text-center">
              <p className="text-sm text-white/55">
                O acesso e criado pela administracao da plataforma.
              </p>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-white/45">
            Ao entrar, voce concorda com os termos da plataforma.
          </p>
        </div>
      </div>
    </div>
  );
};
