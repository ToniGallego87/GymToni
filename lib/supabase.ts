import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseConfig';

// Cliente único de Supabase (Auth + Postgres + Storage). La sesión se persiste
// en AsyncStorage (en web, respaldado por localStorage), así que el login
// sobrevive a reinicios. detectSessionInUrl=false: en móvil no hay callback por
// URL (eso es cosa del OAuth web).
//
// Se construye la PRIMERA VEZ que alguien lo toca, no al evaluar el bundle. La
// librería (más el polyfill de URL) es de las piezas más gordas del arranque, y
// hasta ahora se evaluaba entera —y se levantaba el cliente, con sus temporizadores
// de refresco de token y su lectura de AsyncStorage— antes de que se pintara el
// primer frame, aunque la app funciona sin cuenta. Ahora eso pasa después de la
// primera pantalla, cuando el sync de fondo o la pantalla de cuenta lo piden.
let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    // Parchea `URL` global: lo necesita supabase-js y solo hace falta con él.
    require('react-native-url-polyfill/auto');
    const AsyncStorage =
      require('@react-native-async-storage/async-storage').default;
    const { createClient } =
      require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

// Fachada con la MISMA forma que el cliente (`supabase.auth`, `supabase.from`…),
// para que quien lo usa no sepa nada de la carga perezosa. Los métodos se
// devuelven ligados al cliente: `supabase.from(...)` suelto perdería su `this`.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const value = (getClient() as unknown as Record<string | symbol, unknown>)[
      property
    ];
    return typeof value === 'function' ? value.bind(getClient()) : value;
  },
}) as SupabaseClient;
