import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isLivreur: boolean;
  // false tant que les rôles de l'utilisateur connecté ne sont pas encore chargés.
  rolesResolved: boolean;
  emailConfirmed: boolean;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // null = pas encore résolu ; [] = résolu, aucun rôle particulier (client).
  const [roles, setRoles] = useState<string[] | null>(null);

  useEffect(() => {
    // Listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setRoles(null);
      return;
    }
    let cancelled = false;
    // Defer role check to avoid deadlock inside auth listener
    setTimeout(async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      if (cancelled) return;
      setRoles((data ?? []).map((r) => r.role as string));
    }, 0);
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  return {
    session,
    user: session?.user ?? null,
    loading,
    isAdmin: roles?.includes("admin") ?? false,
    isLivreur: roles?.includes("livreur") ?? false,
    rolesResolved: roles !== null,
    emailConfirmed: !!session?.user?.email_confirmed_at || !!session?.user?.confirmed_at,
  };
}
