import { useState, useEffect } from "react";
import {
  UserCircle,
  At,
  Phone,
  FloppyDisk,
  CircleNotch,
  CheckCircle,
  WarningCircle,
  IdentificationCard,
} from "@phosphor-icons/react";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function AccountPage() {
  const { user, profile, refresh } = useAuth();
  const { canEditOwnName } = usePermissions();

  // Profile State
  const [profileLoading, setProfileLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileFeedback, setProfileFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
    }
  }, [profile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setProfileLoading(true);
    setProfileFeedback(null);
    try {
      // Only update fields the user can edit
      const updateData: { full_name?: string; phone?: string } = {};

      // Only include full_name if user has permission to edit it
      if (canEditOwnName) {
        updateData.full_name = fullName;
      }
      updateData.phone = phone;

      const { error } = await supabase
        .from("user_profiles")
        .update(updateData)
        .eq("user_id", user.id);

      if (error) throw error;

      await refresh();
      setProfileFeedback({
        type: "success",
        message: "Profile updated successfully.",
      });
      setTimeout(() => setProfileFeedback(null), 3000);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      setProfileFeedback({
        type: "error",
        message: error.message || "Failed to update profile.",
      });
    } finally {
      setProfileLoading(false);
    }
  };

  // Check if form has changes (considering name edit permissions)
  const hasChanges = canEditOwnName
    ? fullName !== (profile?.full_name || "") ||
      phone !== (profile?.phone || "")
    : phone !== (profile?.phone || "");

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-10 p-8">
      <header className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
          <UserCircle weight="duotone" className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Account Settings
          </h1>
          <p className="text-slate-500">Manage your profile information.</p>
        </div>
      </header>

      <Separator className="bg-slate-200" />

      {/* Profile Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 text-slate-900">
          <IdentificationCard
            weight="duotone"
            className="w-5 h-5 text-indigo-600"
          />
          <h2 className="text-xl font-bold">Profile Details</h2>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <form onSubmit={handleUpdateProfile} className="p-8 space-y-6">
            {profileFeedback && (
              <div
                className={`p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
                  profileFeedback.type === "success"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                    : "bg-red-50 text-red-700 border border-red-100"
                }`}
              >
                {profileFeedback.type === "success" ? (
                  <CheckCircle weight="duotone" className="w-5 h-5" />
                ) : (
                  <WarningCircle weight="duotone" className="w-5 h-5" />
                )}
                <p className="text-sm font-bold">{profileFeedback.message}</p>
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label
                  htmlFor="full_name"
                  className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1"
                >
                  Full Name
                </Label>
                <div className="relative">
                  <UserCircle
                    weight="duotone"
                    className="absolute left-3 top-3.5 h-4 w-4 text-slate-400"
                  />
                  <Input
                    id="full_name"
                    placeholder="Enter your name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={!canEditOwnName}
                    className={`pl-10 h-11 rounded-xl border-slate-200 transition-all ${
                      !canEditOwnName
                        ? "bg-slate-100/50 text-slate-500 cursor-not-allowed"
                        : "bg-slate-50/50 focus:bg-white"
                    }`}
                    required
                  />
                </div>
                {!canEditOwnName && (
                  <p className="text-[10px] text-slate-400 font-medium px-1 mt-1">
                    Contact an administrator to change your name.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="phone"
                  className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1"
                >
                  Phone Number
                </Label>
                <div className="relative">
                  <Phone
                    weight="duotone"
                    className="absolute left-3 top-3.5 h-4 w-4 text-slate-400"
                  />
                  <Input
                    id="phone"
                    placeholder="Add phone number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10 h-11 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label
                  htmlFor="email"
                  className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1"
                >
                  Email Address
                </Label>
                <div className="relative">
                  <At
                    weight="duotone"
                    className="absolute left-3 top-3.5 h-4 w-4 text-slate-400"
                  />
                  <Input
                    id="email"
                    value={user?.email || ""}
                    disabled
                    className="pl-10 h-11 rounded-xl border-slate-200 bg-slate-100/50 text-slate-500 cursor-not-allowed"
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5 px-1 mt-2">
                  <CheckCircle
                    weight="duotone"
                    className="w-3.5 h-3.5 text-emerald-500"
                  />
                  System Identity Verified
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={profileLoading || !hasChanges}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-8 h-11 font-bold transition-all shadow-lg shadow-slate-200"
              >
                {profileLoading ? (
                  <CircleNotch className="h-4 w-4 animate-spin" />
                ) : (
                  <FloppyDisk weight="duotone" className="mr-2 h-4 w-4" />
                )}
                Update Profile
              </Button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
