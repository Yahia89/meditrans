import { useEffect, useState } from "react";
import { useQueryState } from "nuqs";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle, User, Lock } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

export function AcceptInvitePage() {
  const [token] = useQueryState("token");
  const [, setPage] = useQueryState("page");
  const { user, loading: authLoading, refresh: refreshAuth } = useAuth();

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<any>(null);
  const [inviteeName, setInviteeName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("register");

  // Auth form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthing, setIsAuthing] = useState(false);

  const { signIn } = useAuth();

  useEffect(() => {
    if (!token) {
      setError("No invitation token provided.");
      setLoading(false);
      return;
    }

    async function fetchInvite() {
      try {
        // Fetch the invite details including full_name
        const { data: inviteData, error: inviteError } = await supabase
          .from("org_invites")
          .select("*, organizations(name)")
          .eq("token", token)
          .is("accepted_at", null)
          .single();

        if (inviteError) {
          setError("Invalid or expired invitation.");
          setLoading(false);
          return;
        }

        // Check expiration
        if (new Date(inviteData.expires_at) < new Date()) {
          setError("This invitation has expired.");
          setLoading(false);
          return;
        }

        setInvite(inviteData);
        setEmail(inviteData.email);

        // Use full_name from invite record (set when employee was added)
        if (inviteData.full_name) {
          setInviteeName(inviteData.full_name);
        }
      } catch (err) {
        setError("Failed to fetch invitation details.");
      } finally {
        setLoading(false);
      }
    }

    fetchInvite();
  }, [token]);

  // Auto-accept if user just logged in/signed up and we have an invite
  useEffect(() => {
    if (user && invite && !success && !processing) {
      handleAccept();
    }
  }, [user, invite]);

  const handleAccept = async () => {
    if (!user || !invite || success || processing) return;

    setProcessing(true);
    setError(null);

    try {
      // Get the invitee's name (from invite record)
      const displayName =
        invite.full_name ||
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "User";

      // 1. Create membership (include email for easier lookups)
      const { error: memberError } = await supabase
        .from("organization_memberships")
        .insert({
          org_id: invite.org_id,
          user_id: user.id,
          role: invite.role,
          email: user.email, // Store email for easier lookups
          is_primary: true,
        });

      if (memberError) {
        if (memberError.code === "23505") {
          // already a member, just mark invite as used
        } else {
          throw memberError;
        }
      }

      // 2. Mark invite as accepted
      const { error: updateError } = await supabase
        .from("org_invites")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invite.id);

      if (updateError) throw updateError;

      // 3. Link user to their employee/driver record
      if (invite.role === "driver") {
        const { data: existingDriver } = await supabase
          .from("drivers")
          .select("id, full_name")
          .eq("org_id", invite.org_id)
          .eq("email", invite.email)
          .maybeSingle();

        if (existingDriver) {
          // Update existing driver with user_id and ensure full_name is set
          await supabase
            .from("drivers")
            .update({
              user_id: user.id,
              // Only update name if it was a placeholder or missing
              ...((!existingDriver.full_name ||
                existingDriver.full_name === "Driver") && {
                full_name: displayName,
              }),
            })
            .eq("id", existingDriver.id);
        } else {
          // Create new driver record
          await supabase.from("drivers").insert({
            org_id: invite.org_id,
            user_id: user.id,
            full_name: displayName,
            email: user.email,
            status: "available",
          });
        }
      } else {
        // Link to employee record
        const { data: existingEmployee } = await supabase
          .from("employees")
          .select("id, full_name")
          .eq("org_id", invite.org_id)
          .eq("email", invite.email)
          .maybeSingle();

        if (existingEmployee) {
          // Update existing employee with user_id and ensure full_name is set
          await supabase
            .from("employees")
            .update({
              user_id: user.id,
              // Only update name if it was a placeholder or missing
              ...((!existingEmployee.full_name ||
                existingEmployee.full_name === "User") && {
                full_name: displayName,
              }),
            })
            .eq("id", existingEmployee.id);
        } else {
          // Create new employee record for Owner/Admin/Dispatch who are new to the system
          await supabase.from("employees").insert({
            org_id: invite.org_id,
            user_id: user.id,
            full_name: displayName,
            email: user.email,
            role: invite.role, // "owner", "admin", "dispatcher"
            status: "active",
          });
        }
      }

      // 4. Update user profile with full_name and default org
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("default_org_id, full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const profileUpdates: Record<string, any> = {};

      // Set default org if not set
      if (!profile?.default_org_id) {
        profileUpdates.default_org_id = invite.org_id;
      }

      // Set full_name if not set or is placeholder
      if (
        !profile?.full_name ||
        profile.full_name === "User" ||
        profile.full_name.includes("@")
      ) {
        profileUpdates.full_name = displayName;
      }

      if (Object.keys(profileUpdates).length > 0) {
        await supabase
          .from("user_profiles")
          .update(profileUpdates)
          .eq("user_id", user.id);
      }

      // 5. Force refresh auth context to pick up new memberships
      await refreshAuth();

      setSuccess(true);
    } catch (err: any) {
      console.error("Accept invite error:", err);
      setError(err.message || "Failed to join organization.");
    } finally {
      setProcessing(false);
    }
  };

  // Custom sign up that automatically logs in after (since email confirmation is disabled)
  const handleRegister = async () => {
    if (!password || password.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }

    setIsAuthing(true);
    setAuthError(null);

    try {
      // Sign up with the invitee's name (fetched from employee/driver record)
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: inviteeName || email.split("@")[0] },
        },
      });

      if (signUpError) {
        setAuthError(signUpError.message);
        return;
      }

      // Since email confirmation is disabled, the user should be automatically logged in
      // If not, we sign them in manually
      if (!data.session && data.user) {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          setAuthError(signInError.message);
        }
      }
      // If session exists, the auth listener will pick it up and trigger handleAccept
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsAuthing(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#3D5A3D]" />
        <p className="text-slate-500">Checking invitation...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto p-8 text-center space-y-6">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Invitation Error</h1>
        <p className="text-slate-500">{error}</p>
        <Button
          onClick={() => setPage("dashboard")}
          variant="outline"
          className="w-full"
        >
          Go to Login
        </Button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto p-8 text-center space-y-6">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Success!</h1>
        <p className="text-slate-500">
          You have successfully joined{" "}
          <strong>{invite.organizations.name}</strong> as an {invite.role}.
        </p>
        <Button
          onClick={() => setPage("dashboard")}
          className="w-full bg-[#3D5A3D] hover:bg-[#2E4A2E]"
        >
          Go to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-8 space-y-8 bg-white rounded-2xl border border-slate-200 shadow-xl mt-12">
      <div className="text-center space-y-2">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#3D5A3D]/10 text-[#3D5A3D] mb-2">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Join Organization</h1>
        <p className="text-slate-500">
          You've been invited to join{" "}
          <strong>{invite.organizations.name}</strong> as an{" "}
          <strong>{invite.role}</strong>.
        </p>
      </div>

      {!user ? (
        <div className="space-y-6">
          <div className="space-y-4">
            {authError && (
              <div className="p-3 rounded-lg bg-red-50 text-xs text-red-600 border border-red-100">
                {authError}
              </div>
            )}

            {authMode === "register" ? (
              <>
                {/* Name field - read-only, fetched from employee/driver record */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="h-3 w-3" />
                    Full Name
                  </label>
                  <input
                    type="text"
                    className="w-full h-11 px-4 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 font-medium"
                    value={inviteeName || "—"}
                    disabled
                  />
                  <p className="text-[10px] text-slate-400">
                    Name provided by your organization
                  </p>
                </div>

                {/* Email field - read-only */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="w-full h-11 px-4 rounded-lg border border-slate-200 bg-slate-50 text-slate-500"
                    value={email}
                    disabled
                  />
                </div>

                {/* Password field - editable */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="h-3 w-3" />
                    Create Password
                  </label>
                  <input
                    type="password"
                    placeholder="Min. 6 characters"
                    className="w-full h-11 px-4 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#3D5A3D]/20 outline-none transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                  />
                </div>

                <Button
                  onClick={handleRegister}
                  disabled={isAuthing || authLoading || !password}
                  className="w-full h-11 bg-[#3D5A3D] hover:bg-[#2E4A2E] transition-colors"
                >
                  {isAuthing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Register & Accept"
                  )}
                </Button>

                <p className="text-center text-sm text-slate-500">
                  Already have an account?{" "}
                  <button
                    onClick={() => setAuthMode("login")}
                    className="text-[#3D5A3D] font-semibold hover:underline"
                  >
                    Sign in here
                  </button>
                </p>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="w-full h-11 px-4 rounded-lg border border-slate-200 bg-slate-50 text-slate-500"
                    value={email}
                    disabled
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder="Enter your password"
                    className="w-full h-11 px-4 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#3D5A3D]/20 outline-none"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <Button
                  onClick={async () => {
                    setIsAuthing(true);
                    setAuthError(null);
                    try {
                      const { error } = await signIn(email, password);
                      if (error) setAuthError(error.message);
                    } catch (err: any) {
                      setAuthError(err.message);
                    } finally {
                      setIsAuthing(false);
                    }
                  }}
                  disabled={isAuthing || authLoading}
                  className="w-full h-11 bg-[#3D5A3D] hover:bg-[#2E4A2E]"
                >
                  {isAuthing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Login & Accept"
                  )}
                </Button>

                <p className="text-center text-sm text-slate-500">
                  Need to create an account?{" "}
                  <button
                    onClick={() => setAuthMode("register")}
                    className="text-[#3D5A3D] font-semibold hover:underline"
                  >
                    Register here
                  </button>
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
            <p className="text-xs text-slate-500 mb-1">Signed in as:</p>
            <p className="text-sm font-medium text-slate-900">{user.email}</p>
          </div>
          <Button
            onClick={handleAccept}
            disabled={processing}
            className="w-full h-11 bg-[#3D5A3D] hover:bg-[#2E4A2E]"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Joining...
              </>
            ) : (
              "Accept Invitation"
            )}
          </Button>
          <p className="text-[10px] text-center text-slate-400">
            By clicking "Accept Invitation", you will be added to this
            organization.
          </p>
        </div>
      )}
    </div>
  );
}
