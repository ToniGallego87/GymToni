import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabase';

// Sesión de Supabase reactiva. Persiste en AsyncStorage (ver lib/supabase.ts),
// así que el login sobrevive a reinicios. `loading` es true hasta la primera
// resolución para no parpadear la UI de cuenta.
export function useSession(): {
  session: Session | null;
  user: User | null;
  loading: boolean;
} {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export function signUp(email: string, password: string) {
  return supabase.auth.signUp({ email: email.trim(), password });
}

export function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email: email.trim(), password });
}

export function signOut() {
  return supabase.auth.signOut();
}
