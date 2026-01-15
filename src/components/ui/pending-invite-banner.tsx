import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  EnvelopeOpen,
  CheckCircle,
  X,
  ArrowRight,
} from "@phosphor-icons/react";
import { Loader2 } from "lucide-react";

interface PendingInvite {
  id: string;
  org_id: string;
  email: string;
  role: string;
  token: string;
  created_at: string;
  organization: {
    name: string;
  };
}

interface PendingInviteBannerProps {
  onAccepted?: () => void;
}

/**
 * Banner component that shows when user has pending organization invites
 * Allows them to accept invites directly from the banner
 */
export function PendingInviteBanner({ onAccepted }: PendingInviteBannerProps) {
  const { user, refresh } = useAuth();
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    const fetchPendingInvites = async () => {
      try {
        const { data, error } = await supabase
          .from("org_invites")
          .select(
            `
            id,
            org_id,
            email,
            role,
            token,
            created_at,
            organizations:org_id(name)
          `
          )
          .eq("email", user.email)
          .is("accepted_at", null)
          .gt("expires_at", new Date().toISOString());

        if (error) throw error;

        // Transform the data to match our interface
        const invites = (data || []).map((invite: any) => ({
          ...invite,
          organization: invite.organizations,
        }));

        setPendingInvites(invites);
      } catch (error) {
        console.error("Error fetching pending invites:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPendingInvites();
  }, [user?.email]);

  const handleAccept = async (invite: PendingInvite) => {
    if (!user) return;

    setAcceptingId(invite.id);

    try {
      // 1. Create organization membership
      const { error: memberError } = await supabase
        .from("organization_memberships")
        .insert({
          org_id: invite.org_id,
          user_id: user.id,
          role: invite.role as any,
          is_primary: true,
        });

      if (memberError && memberError.code !== "23505") {
        throw memberError;
      }

      // 2. Mark invite as accepted
      const { error: updateError } = await supabase
        .from("org_invites")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invite.id);

      if (updateError) throw updateError;

      // 3. Update user profile default org if not set
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

      // 4. Remove from pending list
      setPendingInvites((prev) => prev.filter((i) => i.id !== invite.id));

      // 5. Refresh auth context
      await refresh();

      onAccepted?.();
    } catch (error: any) {
      console.error("Error accepting invite:", error);
      alert(error.message || "Failed to accept invitation");
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDismiss = (inviteId: string) => {
    setDismissedIds((prev) => new Set([...prev, inviteId]));
  };

  // Filter out dismissed invites
  const visibleInvites = pendingInvites.filter((i) => !dismissedIds.has(i.id));

  if (loading || visibleInvites.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
      {visibleInvites.map((invite) => (
        <div
          key={invite.id}
          className="relative flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-indigo-50 via-violet-50 to-purple-50 border border-indigo-100/80"
        >
          {/* Close button */}
          <button
            onClick={() => handleDismiss(invite.id)}
            className="absolute top-2 right-2 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-white/60 transition-colors"
          >
            <X size={14} weight="bold" />
          </button>

          {/* Icon */}
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm">
            <EnvelopeOpen size={22} weight="duotone" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800">
              You're invited to join{" "}
              <span className="text-indigo-700">
                {invite.organization.name}
              </span>
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Role:{" "}
              <span className="capitalize font-medium">{invite.role}</span>
            </p>
          </div>

          {/* Action */}
          <Button
            onClick={() => handleAccept(invite)}
            disabled={!!acceptingId}
            size="sm"
            className="shrink-0 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-sm gap-2"
          >
            {acceptingId === invite.id ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Joining...
              </>
            ) : (
              <>
                <CheckCircle size={16} weight="bold" />
                Accept Invite
                <ArrowRight size={14} weight="bold" />
              </>
            )}
          </Button>
        </div>
      ))}
    </div>
  );
}

/**
 * Empty state component for users who haven't accepted their invite yet
 * Shows when user has no organization membership but has pending invites
 */
export function NoAccessState() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 text-amber-600 mb-6">
        <EnvelopeOpen size={32} weight="duotone" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">
        No Organization Access
      </h2>
      <p className="text-sm text-slate-500 max-w-md mb-6">
        You haven't joined any organization yet. Check above for any pending
        invitations, or contact your administrator to send you an invite.
      </p>
      <div className="text-xs text-slate-400">
        Signed in as:{" "}
        <span className="font-medium text-slate-600">{user.email}</span>
      </div>
    </div>
  );
}
