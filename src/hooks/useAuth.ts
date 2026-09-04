import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchCurrentAdmin } from '@/data/api';
import type { AdminUser } from '@/types/db';

export interface AuthState {
  loading: boolean;
  admin: AdminUser | null;
  email: string | null;
}

/** حالة جلسة الإدارة — تُقرأ من Supabase Auth ثم يُتحقق من جدول admin_users */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ loading: true, admin: null, email: null });

  useEffect(() => {
    let alive = true;

    const load = async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      if (!data.session) { setState({ loading: false, admin: null, email: null }); return; }
      const admin = await fetchCurrentAdmin();
      if (!alive) return;
      setState((prev) => {
        // If transient fetch returned null but we already had an admin profile, retain existing admin
        const effectiveAdmin = admin ?? prev.admin;
        return { loading: false, admin: effectiveAdmin, email: data.session?.user.email ?? prev.email };
      });
    };

    void load();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        if (alive) setState({ loading: false, admin: null, email: null });
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        void load();
      }
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  return state;
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(
    error.message.includes('Invalid login')
      ? 'بيانات الدخول غير صحيحة.'
      : `تعذّر تسجيل الدخول: ${error.message}`,
  );
}

export async function signOut() {
  await supabase.auth.signOut();
}
