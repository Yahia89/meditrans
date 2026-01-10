import { createContext, useContext, useEffect, useState } from "react";
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
  ) => Promise<{
    error: AuthError | null;
  }>;
  signUp: (
    email: string,
    password: string,
    fullName?: string
  ) => Promise<{
    error: AuthError | null;
  }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{
    error: AuthError | null;
  }>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [memberships, setMemberships] = useState<OrganizationMembership[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch user profile
  const fetchProfile = async (userId: string) => {
    try {
      // 1. Get base profile
      const { data: userProfile, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;

      let finalProfile = userProfile;

      // 2. Check if user is a driver (often has more up-to-date info)
      const { data: driverProfile } = await supabase
        .from("drivers")
        .select("full_name, phone")
        .eq("user_id", userId)
        .maybeSingle();

      if (driverProfile) {
        if (!finalProfile) {
          // Create synthetic profile if none exists
          finalProfile = {
            user_id: userId,
            full_name: driverProfile.full_name,
            phone: driverProfile.phone,
            default_org_id: null,
            is_super_admin: false,
            created_at: new Date().toISOString(),
          };
        } else {
          // Merge driver info if profile info is missing
          if (!finalProfile.full_name && driverProfile.full_name) {
            finalProfile.full_name = driverProfile.full_name;
          }
          if (!finalProfile.phone && driverProfile.phone) {
            finalProfile.phone = driverProfile.phone;
          }
        }
      }

      setProfile(finalProfile || null);
    } catch (error) {
      console.error("Error fetching profile:", error);
      setProfile(null);
    }
  };

  // Fetch user's organization memberships
  const fetchMemberships = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("organization_memberships")
        .select("*")
        .eq("user_id", userId)
        .order("is_primary", { ascending: false });

      if (error) throw error;
      setMemberships(data || []);
    } catch (error) {
      console.error("Error fetching memberships:", error);
      setMemberships([]);
    }
  };

  // Initialize auth state
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        // Wait for core data before finishing load
        await Promise.all([
          fetchProfile(currentUser.id),
          fetchMemberships(currentUser.id),
        ]);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await Promise.all([
          fetchProfile(currentUser.id),
          fetchMemberships(currentUser.id),
        ]);
      } else {
        setProfile(null);
        setMemberships([]);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  // Sign up with email and password
  const signUp = async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    // Create user profile if signup successful
    if (data.user && !error) {
      await supabase.from("user_profiles").insert({
        user_id: data.user.id,
        full_name: fullName || null,
      });
    }

    return { error };
  };

  // Sign out
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Reset password
  const resetPassword = async (email: string) => {
    // Construct redirect URL accommodating for the base path (e.g. /meditrans/)
    const baseUrl = window.location.origin + import.meta.env.BASE_URL;
    const redirectUrl = new URL("reset-password", baseUrl).toString();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { error };
  };

  // Force refresh profile and memberships
  const refresh = async () => {
    if (user) {
      await Promise.all([fetchProfile(user.id), fetchMemberships(user.id)]);
    }
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
