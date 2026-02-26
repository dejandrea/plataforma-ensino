import { createClient } from '@supabase/supabase-js';

// Essas chaves você encontra no painel do Supabase em Settings > API
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Exportamos o cliente para usar em qualquer parte do app
export const supabase = createClient(supabaseUrl, supabaseAnonKey);