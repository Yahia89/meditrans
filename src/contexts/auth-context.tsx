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

  // Effect 1: Handle Initial Session and Auth State Listener
  // Using the native v2.90+ getSession (safe now due to lockAcquisitionTimeout)
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) setLoading(false);
    });

    // Synchronous listener - no await inside to avoid holding locks
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (!newSession) {
        setProfile(null);
        setMemberships([]);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Effect 2: Reactively fetch profile data when user changes
  // This separates data fetching from the auth listener to avoid holding locks
  useEffect(() => {
    if (user?.id) {
      fetchUserData(user.id);
    }
  }, [user?.id, fetchUserData]);

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
    const redirectUrl = new URL(baseUrl);
    redirectUrl.searchParams.set("page", "reset-password");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl.toString(),
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

export type { UserProfile, OrganizationMembership };
