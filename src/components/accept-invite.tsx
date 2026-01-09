import { useEffect, useState } from "react";
import { useQueryState } from "nuqs";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

export function AcceptInvitePage() {
  const [token] = useQueryState("token");
  const [, setPage] = useQueryState("page");
  const { user, loading: authLoading, refresh: refreshAuth } = useAuth();

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("register");

  // Auth form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthing, setIsAuthing] = useState(false);

  const { signIn, signUp } = useAuth();

  useEffect(() => {
    if (!token) {
      setError("No invitation token provided.");
      setLoading(false);
      return;
    }

    async function fetchInvite() {
      try {
        const { data, error } = await supabase
          .from("org_invites")
          .select("*, organizations(name)")
          .eq("token", token)
          .is("accepted_at", null)
          .single();

        if (error) {
          setError("Invalid or expired invitation.");
        } else {
          // Check expiration
          if (new Date(data.expires_at) < new Date()) {
            setError("This invitation has expired.");
          } else {
            setInvite(data);
            setEmail(data.email);
          }
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
      // 1. Create membership
      const { error: memberError } = await supabase
        .from("organization_memberships")
        .insert({
          org_id: invite.org_id,
          user_id: user.id,
          role: invite.role,
          is_primary: true,
        });

      if (memberError) {
        if (memberError.code === "23505") {
          // already a member, just mark invite as used?
          // Actually, mark it as used is fine
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

      // 3. If driver, ensure driver record exists and is linked
      if (invite.role === "driver") {
        const { data: existingDriver } = await supabase
          .from("drivers")
          .select("id")
          .eq("org_id", invite.org_id)
          .eq("email", invite.email)
          .maybeSingle();

        if (existingDriver) {
          await supabase
            .from("drivers")
            .update({ user_id: user.id })
            .eq("id", existingDriver.id);
        } else {
          await supabase.from("drivers").insert({
            org_id: invite.org_id,
            user_id: user.id,
            full_name:
              user.user_metadata?.full_name ||
              fullName ||
              user.email?.split("@")[0] ||
              "Driver",
            email: user.email,
            status: "available",
          });
        }
      }

      // 4. Update user profile default org if they don't have one
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("default_org_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile && !profile.default_org_id) {
        await supabase
          .from("user_profiles")
          .update({ default_org_id: invite.org_id })
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
          <div className="flex p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setAuthMode("register")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                authMode === "register"
                  ? "bg-white shadow text-slate-900"
                  : "text-slate-500"
              }`}
            >
              Sign Up
            </button>
            <button
              onClick={() => setAuthMode("login")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                authMode === "login"
                  ? "bg-white shadow text-slate-900"
                  : "text-slate-500"
              }`}
            >
              Login
            </button>
          </div>

          <div className="space-y-4">
            {authError && (
              <div className="p-3 rounded-lg bg-red-50 text-xs text-red-600 border border-red-100">
                {authError}
              </div>
            )}

            {authMode === "register" && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  className="w-full h-11 px-4 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#3D5A3D]/20 outline-none"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                placeholder="name@company.com"
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
                placeholder="Min. 6 characters"
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
                  const { error } =
                    authMode === "login"
                      ? await signIn(email, password)
                      : await signUp(email, password, fullName);

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
              ) : authMode === "login" ? (
                "Login & Accept"
              ) : (
                "Register & Accept"
              )}
            </Button>
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
