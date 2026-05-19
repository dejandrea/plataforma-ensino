import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export const ProtectedRoute = ({ children, allowedRole }: { children: any, allowedRole: string }) => {
  const [loading, setLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    setIsAllowed(profile?.role === allowedRole);
    setLoading(false);
  }

  if (loading) return <div>Protegendo rotas...</div>;

  return isAllowed ? children : <Navigate to="/" replace />;
};