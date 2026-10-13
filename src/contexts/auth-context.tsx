import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import type { User, Session, AuthError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearPrivateQueries, fetchIdentityBootstrap, identityQueryKey, reconcileIdentityAccess,
  type IdentityBootstrap, type UserProfile, type OrganizationMembership,
} from "@/lib/identity-bootstrap";
import { markStartup } from "@/lib/startup-performance";

const EMPTY_MEMBERSHIPS: OrganizationMembership[] = [];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  memberships: OrganizationMembership[];
  loading: boolean;
  error: Error | null;
  bootstrap: IdentityBootstrap | undefined;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: AuthError | null }>;
  signUp: (
    email: string,
    password: string,
    fullName?: string,
  ) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined)
    throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  const [authState, setAuthState] = useState<{ session: Session | null; resolved: boolean; error: Error | null }>({
    session: null, resolved: false, error: null,
  });
  const sessionRevision = useRef(0);
  const currentUserId = useRef<string | null | undefined>(undefined);
  const session = authState.session;
  const user = session?.user ?? null;
  const userId = user?.id ?? null;
  const identityQuery = useQuery({
    queryKey: identityQueryKey(userId),
    enabled: authState.resolved && !!userId,
    queryFn: async ({ signal }) => {
      if (!userId) throw new Error("Sign in to load your workspace.");
      const identity = await fetchIdentityBootstrap(supabase, userId, signal);
      return reconcileIdentityAccess(queryClient, identity);
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const bootstrap = identityQuery.data?.userId === userId ? identityQuery.data : undefined;
  const profile = bootstrap?.profile ?? null;
  const memberships = bootstrap?.memberships ?? EMPTY_MEMBERSHIPS;
  const loading = !authState.resolved || (!!userId && identityQuery.isPending);
  const error = authState.error ?? identityQuery.error;

  // This callback remains synchronous: no Supabase requests under the auth lock.
  const applySession = useCallback((nextSession: Session | null, sessionError: Error | null = null) => {
    sessionRevision.current += 1;
    const nextUserId = nextSession?.user.id ?? null;
    if (currentUserId.current !== nextUserId) {
      clearPrivateQueries(queryClient);
      currentUserId.current = nextUserId;
    }
    setAuthState({ session: nextSession, resolved: true, error: sessionError });
    markStartup("session-resolved");
  }, [queryClient]);

  useEffect(() => {
    let mounted = true;
    let eventVersion = 0;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      eventVersion += 1;
      if (mounted) applySession(nextSession);
    });
    const versionAtRead = eventVersion;
    const revisionAtRead = sessionRevision.current;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      // A late initial read must not resurrect a session after SIGNED_OUT.
      if (mounted && eventVersion === versionAtRead && sessionRevision.current === revisionAtRead) applySession(data.session, sessionError);
    }).catch(() => {
      if (mounted && eventVersion === versionAtRead && sessionRevision.current === revisionAtRead) applySession(null, new Error("Unable to resolve your session."));
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [applySession]);

  useEffect(() => {
    if (bootstrap) markStartup("identity-ready");
  }, [bootstrap]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    return { error };
  };

  const signOut = async () => {
    // Remove protected UI and data before waiting for the remote logout request.
    applySession(null);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw signOutError;
  };

  const resetPassword = async (email: string) => {
    const baseUrl = window.location.origin + (import.meta.env.BASE_URL || "/");
    const redirectUrl = new URL(baseUrl);
    redirectUrl.searchParams.set("page", "reset-password");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl.toString(),
    });
    return { error };
  };

  const refresh = async () => {
    if (!userId) {
      const revisionAtRead = ++sessionRevision.current;
      setAuthState((previous) => ({ ...previous, resolved: false, error: null }));
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionRevision.current === revisionAtRead) applySession(data.session, sessionError);
      } catch {
        if (sessionRevision.current === revisionAtRead) applySession(null, new Error("Unable to resolve your session."));
      }
      return;
    }
    // Retain known identity while refreshing; all consumers share this request.
    await queryClient.invalidateQueries({ queryKey: identityQueryKey(userId), exact: true });
  };

  const value = {
    user,
    session,
    profile,
    memberships,
    loading,
    error,
    bootstrap,
    signIn,
    signUp,
    signOut,
    resetPassword,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export type { UserProfile, OrganizationMembership };
