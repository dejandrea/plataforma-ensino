import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const handleLogout = async () => {
  await supabase.auth.signOut();
  window.location.href = "/"; // Força o redirecionamento
};

export const Navbar = () => {
  return (
    <nav className="bg-white border-b border-gray-200 py-4 px-6 flex justify-between items-center sticky top-0 z-10">
      <Link
        to="/dashboard"
        className="text-xl font-bold text-blue-600 flex items-center gap-2"
      >
        🚀 <span>Plataforma Kids</span>
      </Link>

      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-600">Olá, Aluno!</span>
        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
          A
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded hover:bg-red-50"
        >
          Sair
        </button>
      </div>
    </nav>
  );
};
