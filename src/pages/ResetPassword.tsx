import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (mounted) {
        setHasSession(Boolean(session));
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      setMessage("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("As senhas nao conferem.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Senha atualizada com sucesso. Agora voce ja pode entrar.");
      setPassword("");
      setConfirmPassword("");
    }

    setLoading(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-brand-900 font-sans text-brand-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-pink/20 blur-3xl" />
        <div className="absolute -bottom-24 right-10 h-72 w-72 rounded-full bg-brand-lavender/20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-3xl bg-white/5 p-7 shadow-soft ring-1 ring-white/10 backdrop-blur md:p-8">
          <div className="text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-purple to-brand-pink shadow-soft ring-1 ring-white/10">
              <span className="text-2xl">🔐</span>
            </div>

            <h1 className="mt-5 text-3xl font-extrabold tracking-tight">
              Redefinir senha
            </h1>
            <p className="mt-2 text-sm text-white/65">
              Defina uma nova senha para acessar a plataforma.
            </p>
          </div>

          {hasSession ? (
            <form onSubmit={handleUpdatePassword} className="mt-7 space-y-4">
              <div>
                <label className="ml-1 text-xs font-semibold uppercase tracking-wide text-white/60">
                  Nova senha
                </label>
                <input
                  type="password"
                  className="mt-2 w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 placeholder:text-white/35 outline-none transition focus:ring-2 focus:ring-brand-lavender"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className="ml-1 text-xs font-semibold uppercase tracking-wide text-white/60">
                  Confirmar senha
                </label>
                <input
                  type="password"
                  className="mt-2 w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 placeholder:text-white/35 outline-none transition focus:ring-2 focus:ring-brand-lavender"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-magenta to-brand-pink px-4 py-3 text-sm font-bold text-white shadow-soft ring-1 ring-white/10 transition hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Atualizando..." : "Salvar nova senha"}
              </button>
            </form>
          ) : (
            <div className="mt-7 rounded-2xl bg-white/5 p-4 text-sm text-white/70 ring-1 ring-white/10">
              Abra esta tela pelo link enviado no e-mail de recuperacao para
              redefinir sua senha com seguranca.
            </div>
          )}

          {message && (
            <div className="mt-5 rounded-2xl bg-white/5 p-4 text-sm text-white/80 ring-1 ring-white/10">
              {message}
            </div>
          )}

          <div className="mt-6 text-center">
            <Link
              to="/"
              className="text-sm font-semibold text-brand-lavender transition hover:text-brand-pink"
            >
              Voltar para o login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
