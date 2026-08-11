import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseConfig';

// Cliente único de Supabase (Auth + Postgres + Storage). La sesión se persiste
// en AsyncStorage (en web, respaldado por localStorage), así que el login
// sobrevive a reinicios. detectSessionInUrl=false: en móvil no hay callback por
// URL (eso es cosa del OAuth web).
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
