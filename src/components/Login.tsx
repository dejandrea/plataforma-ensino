import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Função para Entrar
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) alert(error.message);
    else navigate('/dashboard');
    setLoading(false);
  };

  // Função para Criar Conta (O Aluno se cadastra sozinho por enquanto)
  const handleSignUp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) alert(error.message);
    else alert('Conta criada! Agora você pode entrar.');
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-blue-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h2 className="text-3xl font-bold text-center text-blue-600 mb-6">Escola de Devs 🚀</h2>
        
        <form onSubmit={handleSignIn} className="space-y-4">
          <input 
            type="email" placeholder="Seu melhor e-mail"
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
            value={email} onChange={(e) => setEmail(e.target.value)} required
          />
          <input 
            type="password" placeholder="Sua senha secreta"
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
            value={password} onChange={(e) => setPassword(e.target.value)} required
          />
          
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 transition">
            {loading ? 'Carregando...' : 'Entrar na Plataforma'}
          </button>
        </form>

        <button onClick={handleSignUp} className="w-full mt-4 text-sm text-blue-500 hover:underline">
          Não tem conta? Cadastre-se aqui!
        </button>
      </div>
    </div>
  );
};