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
  Globe,
  Gear,
} from "@phosphor-icons/react";
import { TimezoneSelector } from "./timezone-selector";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function AccountPage() {
  const { user, profile, refresh } = useAuth();
  const { currentOrganization, refreshOrganization } = useOrganization();
  const { canEditOwnName, isOwner } = usePermissions();

  // Profile State
  const [profileLoading, setProfileLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileFeedback, setProfileFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Timezone State
  const [userTimezone, setUserTimezone] = useState("");
  const [orgTimezone, setOrgTimezone] = useState("");
  const [timezoneLoading, setTimezoneLoading] = useState(false);
  const [orgTimezoneLoading, setOrgTimezoneLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      setUserTimezone(profile.timezone || "");
    }
  }, [profile]);

  useEffect(() => {
    if (currentOrganization) {
      setOrgTimezone(currentOrganization.timezone || "America/Chicago");
    }
  }, [currentOrganization]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setProfileLoading(true);
    setProfileFeedback(null);
    try {
      if (phone && phone.replace(/[^\d]/g, "").length < 10) {
        throw new Error("Please enter a valid 10-digit phone number");
      }
      const updateData: { full_name?: string; phone?: string } = {};
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

  const handleUpdateTimezone = async () => {
    if (!user) return;
    setTimezoneLoading(true);
    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ timezone: userTimezone || null })
        .eq("user_id", user.id);

      if (error) throw error;
      await refresh();
      toast.success("Your timezone preference updated");
    } catch (error: any) {
      console.error("Error updating timezone:", error);
      toast.error(error.message || "Failed to update timezone");
    } finally {
      setTimezoneLoading(false);
    }
  };

  const handleUpdateOrgTimezone = async () => {
    if (!currentOrganization) return;
    setOrgTimezoneLoading(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({ timezone: orgTimezone })
        .eq("id", currentOrganization.id);

      if (error) throw error;
      await refreshOrganization();
      toast.success("Organization timezone updated");
    } catch (error: any) {
      console.error("Error updating org timezone:", error);
      toast.error(error.message || "Failed to update org timezone");
    } finally {
      setOrgTimezoneLoading(false);
    }
  };

  const formatPhoneNumber = (value: string) => {
    if (!value) return value;
    const phoneNumber = value.replace(/[^\d]/g, "");
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 7) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(
      6,
      10,
    )}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
  };

  const hasChanges = canEditOwnName
    ? fullName !== (profile?.full_name || "") ||
      phone !== (profile?.phone || "")
    : phone !== (profile?.phone || "");

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-10 p-8 pb-32">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3D5A3D] text-white shadow-lg shadow-[#3D5A3D]/20">
            <Gear weight="duotone" className="h-6 w-6" />
          </div>
          <span className="text-[10px] font-bold text-[#3D5A3D] uppercase tracking-[0.2em]">
            Settings & Profile
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Account Settings
        </h1>
        <p className="text-slate-500 font-medium">
          Manage your personal identification and regional preferences.
        </p>
      </header>

      <div className="space-y-12">
        <div className="max-w-2xl space-y-12">
          {/* Profile Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-2.5 text-slate-900 mb-2">
              <IdentificationCard
                weight="duotone"
                className="w-5 h-5 text-[#3D5A3D]"
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
                    <p className="text-sm font-bold">
                      {profileFeedback.message}
                    </p>
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
                        placeholder="(XXX) XXX-XXXX"
                        value={phone}
                        onChange={handlePhoneChange}
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
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={profileLoading || !hasChanges}
                    className="bg-[#3D5A3D] hover:bg-[#2E4A2E] text-white rounded-xl px-8 h-12 font-bold transition-all shadow-lg shadow-[#3D5A3D]/20 leading-none"
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

          {/* Timezone Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-2.5 text-slate-900 mb-2">
              <Globe weight="duotone" className="w-5 h-5 text-[#3D5A3D]" />
              <h2 className="text-xl font-bold">Regional Preferences</h2>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-8 space-y-8">
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                      Your Personal Timezone
                    </Label>
                    <p className="text-xs text-slate-500 mb-5 ml-1 leading-relaxed">
                      This setting only affects{" "}
                      <span className="font-semibold text-slate-700">
                        your view
                      </span>
                      . Other team members will not be affected by this
                      preference.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <TimezoneSelector
                        value={userTimezone}
                        onValueChange={setUserTimezone}
                        className="flex-1 max-w-sm"
                        placeholder="Use Organization Default"
                      />
                      <Button
                        onClick={handleUpdateTimezone}
                        disabled={
                          timezoneLoading ||
                          userTimezone === (profile?.timezone || "")
                        }
                        className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-6 h-11 font-bold shadow-md"
                      >
                        {timezoneLoading ? (
                          <CircleNotch className="h-4 w-4 animate-spin" />
                        ) : (
                          "Save Preference"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {isOwner && (
                  <>
                    <div className="h-px bg-slate-100" />
                    <div className="space-y-4">
                      <div>
                        <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                          Organization Default Timezone
                        </Label>
                        <p className="text-xs text-slate-500 mb-5 ml-1 leading-relaxed">
                          Primary timezone for{" "}
                          <span className="font-bold text-slate-900">
                            {currentOrganization?.name}
                          </span>
                          .
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                          <TimezoneSelector
                            value={orgTimezone}
                            onValueChange={setOrgTimezone}
                            className="flex-1 max-w-sm"
                          />
                          <Button
                            onClick={handleUpdateOrgTimezone}
                            disabled={
                              orgTimezoneLoading ||
                              orgTimezone ===
                                (currentOrganization?.timezone || "")
                            }
                            className="bg-[#3D5A3D] hover:bg-[#2E4A2E] text-white rounded-xl px-6 h-11 font-bold shadow-md"
                          >
                            {orgTimezoneLoading ? (
                              <CircleNotch className="h-4 w-4 animate-spin" />
                            ) : (
                              "Update Organization"
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
