// Credenciales del proyecto Supabase (Project Settings → API).
// La anon key es PÚBLICA (va en la app, protegida por RLS). NUNCA poner aquí la
// service_role. Rellenar con los valores del proyecto.
export const SUPABASE_URL = 'https://TODO.supabase.co';
export const SUPABASE_ANON_KEY = 'TODO';

export const isSupabaseConfigured =
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('TODO') &&
  SUPABASE_ANON_KEY.length > 20;
