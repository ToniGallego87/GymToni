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

/**
 * Nunca como anónimo con una cuenta en el móvil. Con el token caducado y sin
 * poder renovarlo (sin red, el servidor de Auth caído, o el minuto que
 * supabase-js espera tras un fallo antes de reintentar), supabase-js no da
 * error: manda la petición con la clave pública en vez del token. La RLS la
 * trata como de alguien sin cuenta y responde sin error pero vacío (0
 * seguidores, ninguna lectura) o la rechaza: el outbox sumaba intentos hasta
 * descartar cambios, un borrado salía "bien" sin tocar nada, y Comunidad
 * guardaba lo vacío como copia de la cuenta. Así que, si hay sesión guardada,
 * esa petición se corta como si no hubiera red, que es lo que todo el código
 * ya sabe llevar (reintentar luego). Auth va aparte: siempre usa la clave.
 */
export async function accountSafeFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.href
      : input.url;
  if (!url.includes('/auth/v1/')) {
    const auth = new Headers(init?.headers).get('Authorization');
    if (!auth || auth === `Bearer ${SUPABASE_ANON_KEY}`) {
      const { hasStoredSession } =
        require('./cloud/storedSession') as typeof import('./cloud/storedSession');
      if (await hasStoredSession()) {
        throw new TypeError('Network request failed');
      }
    }
  }
  return fetch(input, init);
}

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
      global: { fetch: accountSafeFetch },
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
