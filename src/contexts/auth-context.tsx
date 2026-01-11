import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import type { User, Session, AuthError } from "@supabase/supabase-js";
import { supabase, type MembershipRole } from "@/lib/supabase";

// Types
interface UserProfile {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  default_org_id: string | null;
  is_super_admin: boolean;
  created_at: string;
}

interface OrganizationMembership {
  id: string;
  org_id: string;
  user_id: string;
  role: MembershipRole;
  is_primary: boolean;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  memberships: OrganizationMembership[];
  loading: boolean;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: AuthError | null }>;
  signUp: (
    email: string,
    password: string,
    fullName?: string
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
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [memberships, setMemberships] = useState<OrganizationMembership[]>([]);
  const [loading, setLoading] = useState(true);

  // Ref to prevent multiple simultaneous fetch calls during race conditions
  const isFetchingData = useRef(false);

  const fetchUserData = useCallback(async (userId: string) => {
    if (isFetchingData.current) return;
    isFetchingData.current = true;

    try {
      // 1. Get base profile & driver profile in parallel
      const [profileRes, driverRes, membershipRes] = await Promise.all([
        supabase
          .from("user_profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("drivers")
          .select("full_name, phone")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("organization_memberships")
          .select("*")
          .eq("user_id", userId)
          .order("is_primary", { ascending: false }),
      ]);

      let finalProfile = profileRes.data;

      if (driverRes.data) {
        if (!finalProfile) {
          finalProfile = {
            user_id: userId,
            full_name: driverRes.data.full_name,
            phone: driverRes.data.phone,
            default_org_id: null,
            is_super_admin: false,
            created_at: new Date().toISOString(),
          };
        } else {
          finalProfile.full_name =
            finalProfile.full_name || driverRes.data.full_name;
          finalProfile.phone = finalProfile.phone || driverRes.data.phone;
        }
      }

      setProfile(finalProfile || null);
      setMemberships(membershipRes.data || []);
    } catch (error) {
      console.error("Auth Data Fetch Error:", error);
    } finally {
      isFetchingData.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Safety fallback: If getSession() deadlocks due to Web Locks API in Safari/Production
    const getSessionWithTimeout = async () => {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Session Timeout")), 2500)
      );

      try {
        const {
          data: { session },
        } = await (Promise.race([
          supabase.auth.getSession(),
          timeoutPromise,
        ]) as Promise<{ data: { session: Session | null } }>);

        return session;
      } catch (err) {
        console.warn(
          "Supabase Web Lock detected or Timeout. Falling back to local storage."
        );
        // Find the Supabase key in localStorage (usually starts with sb-...)
        const storageKey = Object.keys(localStorage).find(
          (key) => key.startsWith("sb-") && key.endsWith("-auth-token")
        );
        if (storageKey) {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            try {
              return JSON.parse(raw) as Session;
            } catch {
              return null;
            }
          }
        }
        return null;
      }
    };

    const initializeAuth = async () => {
      const currentSession = await getSessionWithTimeout();

      if (!mounted) return;

      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
        await fetchUserData(currentSession.user.id);
      } else {
        setLoading(false);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        await fetchUserData(newSession.user.id);
      } else {
        setProfile(null);
        setMemberships([]);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (data.user && !error) {
      await supabase.from("user_profiles").insert({
        user_id: data.user.id,
        full_name: fullName || null,
      });
    }
    return { error };
  };

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setMemberships([]);
    setLoading(false);
  };

  const resetPassword = async (email: string) => {
    const baseUrl = window.location.origin + (import.meta.env.BASE_URL || "/");
    const redirectUrl = new URL("reset-password", baseUrl).toString();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { error };
  };

  const refresh = async () => {
    if (user) await fetchUserData(user.id);
  };

  const value = {
    user,
    session,
    profile,
    memberships,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
