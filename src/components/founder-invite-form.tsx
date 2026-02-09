import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CircleNotch,
  Buildings,
  UserPlus,
  Shield,
  Copy,
  Phone,
  MapPin,
} from "@phosphor-icons/react";
import { TimezoneSelector } from "./timezone-selector";
import { StateSelector } from "./state-selector";
import { cn } from "@/lib/utils";

const founderSchema = z.object({
  org_name: z
    .string()
    .min(3, "Organization name must be at least 3 characters"),
  operating_state: z.string().min(2, "State is required (e.g. TX)"),
  contact_phone: z.string().min(10, "Valid phone number required"),
  owner_email: z.string().email("Invalid email address"),
  owner_name: z.string().min(2, "Owner name must be at least 2 characters"),
  timezone: z.string().min(1, "Please select a timezone"),
});

type FounderFormData = z.infer<typeof founderSchema>;

const formatPhoneNumber = (value: string) => {
  if (!value) return value;
  const phoneNumber = value.replace(/[^\d]/g, "");
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 7) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  }
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(
    3,
    6,
  )}-${phoneNumber.slice(6, 10)}`;
};

export function FounderInviteForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [lastInviteEmail, setLastInviteEmail] = useState<string>("");

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FounderFormData>({
    resolver: zodResolver(founderSchema),
    defaultValues: {
      org_name: "",
      operating_state: "",
      contact_phone: "",
      owner_email: "",
      owner_name: "",
      timezone: "America/Chicago",
    },
  });

  const onSubmit = async (data: FounderFormData) => {
    setIsSubmitting(true);
    try {
      // Sanitize phone number
      const sanitizedPhone = data.contact_phone.replace(/\D/g, "");

      // 1. Create Organization
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: data.org_name,
          slug: data.org_name
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^\w-]/g, ""),
          timezone: data.timezone,
          contact_name: data.owner_name,
          contact_phone: sanitizedPhone,
          operating_state: data.operating_state,
          billing_email: data.owner_email,
          onboarding_status: "pending",
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // 2. Create Invite for the first owner
      const { error: inviteError } = await supabase.from("org_invites").insert({
        org_id: org.id,
        email: data.owner_email,
        role: "owner",
        invited_by: (await supabase.auth.getUser()).data.user?.id,
      });

      if (inviteError) throw inviteError;

      // Fetch the generated token to show the manual link
      const { data: inviteData } = await supabase
        .from("org_invites")
        .select("token")
        .eq("org_id", org.id)
        .eq("email", data.owner_email)
        .is("accepted_at", null)
        .single();

      setInviteToken(inviteData?.token || null);
      setLastInviteEmail(data.owner_email);
      setSuccess(true);
      reset();
    } catch (err: any) {
      console.error("Founder tool error:", err);
      alert(err.message || "Failed to create organization and invite.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    const inviteUrl = `${window.location.origin}${import.meta.env.BASE_URL}?page=accept-invite&token=${inviteToken}`;

    return (
      <div className="p-8 text-center space-y-6">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-green-50 text-green-600 border-2 border-green-100 shadow-sm">
          <Buildings weight="duotone" className="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900">
            Organization Created!
          </h2>
          <p className="text-slate-500 max-w-md mx-auto">
            The organization has been established and an invitation link has
            been sent to <strong>{lastInviteEmail}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2 max-w-md mx-auto p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <code className="text-xs flex-1 truncate text-left text-slate-600 font-mono">
            {inviteUrl}
          </code>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              navigator.clipboard.writeText(inviteUrl);
              alert("Link copied to clipboard!");
            }}
            className="flex items-center gap-1.5 h-9 rounded-lg hover:bg-white border hover:border-slate-200 transition-all font-semibold"
          >
            <Copy weight="bold" className="h-4 w-4" />
            Copy
          </Button>
        </div>

        <div className="pt-4">
          <Button
            onClick={() => setSuccess(false)}
            variant="outline"
            className="rounded-xl h-11 px-8 border-slate-200"
          >
            Create Another Organization
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-10">
      <div className="flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-[#3D5A3D]/10 flex items-center justify-center border-2 border-[#3D5A3D]/20 shadow-sm shrink-0">
          <Shield weight="duotone" className="w-10 h-10 text-[#3D5A3D]" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight">
            Founder Onboarding Tool
          </h1>
          <p className="text-slate-500 text-sm">
            Create a new organization and invite its first owner.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="space-y-6 rounded-2xl border border-slate-200 p-6 bg-slate-50/30 shadow-sm">
          <h3 className="font-bold text-slate-900 flex items-center gap-2.5 text-sm tracking-wide">
            <Buildings weight="duotone" className="h-5 w-5 text-[#3D5A3D]" />
            Organization Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">
                Organization Name
              </label>
              <Input
                {...register("org_name")}
                placeholder="e.g., City Medical Transport"
                className={cn(
                  "h-11 rounded-xl bg-white border-slate-200 focus:border-[#3D5A3D] transition-all px-4",
                  errors.org_name && "border-red-500 focus:border-red-500",
                )}
              />
              {errors.org_name && (
                <p className="text-[10px] text-red-500 font-bold tracking-tight">
                  {errors.org_name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <MapPin weight="duotone" className="w-3.5 h-3.5 text-red-500" />
                Operating State
              </label>
              <Controller
                name="operating_state"
                control={control}
                render={({ field }) => (
                  <StateSelector
                    value={field.value}
                    onValueChange={field.onChange}
                    className={cn(
                      "w-full bg-white",
                      errors.operating_state && "border-red-500",
                    )}
                  />
                )}
              />
              {errors.operating_state && (
                <p className="text-[10px] text-red-500 font-bold tracking-tight">
                  {errors.operating_state.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <Phone weight="fill" className="w-3.5 h-3.5 text-[#3D5A3D]" />
                Contact Phone
              </label>
              <Controller
                name="contact_phone"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    placeholder="(555) 555-5555"
                    onChange={(e) => {
                      const formatted = formatPhoneNumber(e.target.value);
                      field.onChange(formatted);
                    }}
                    className={cn(
                      "h-11 rounded-xl bg-white border-slate-200 focus:border-[#3D5A3D] transition-all px-4",
                      errors.contact_phone &&
                        "border-red-500 focus:border-red-500",
                    )}
                  />
                )}
              />
              {errors.contact_phone && (
                <p className="text-[10px] text-red-500 font-bold tracking-tight">
                  {errors.contact_phone.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">
                Primary Timezone
              </label>
              <Controller
                name="timezone"
                control={control}
                render={({ field }) => (
                  <TimezoneSelector
                    value={field.value}
                    onValueChange={field.onChange}
                    className="w-full bg-white shadow-sm border-slate-200 rounded-xl h-11"
                  />
                )}
              />
              {errors.timezone && (
                <p className="text-[10px] text-red-500 font-bold tracking-tight">
                  {errors.timezone.message}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6 rounded-2xl border border-slate-200 p-6 bg-slate-50/30 shadow-sm">
          <h3 className="font-bold text-slate-900 flex items-center gap-2.5 text-sm tracking-wide">
            <UserPlus weight="duotone" className="h-5 w-5 text-[#3D5A3D]" />
            First Owner Details
          </h3>
          <div className="grid grid-cols-1 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">
                Full Name
              </label>
              <Input
                {...register("owner_name")}
                placeholder="e.g., John Smith"
                className={cn(
                  "h-11 rounded-xl bg-white border-slate-200 focus:border-[#3D5A3D] transition-all px-4",
                  errors.owner_name && "border-red-500 focus:border-red-500",
                )}
              />
              {errors.owner_name && (
                <p className="text-[10px] text-red-500 font-bold tracking-tight">
                  {errors.owner_name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">
                Email Address
              </label>
              <Input
                {...register("owner_email")}
                type="email"
                placeholder="owner@company.com"
                className={cn(
                  "h-11 rounded-xl bg-white border-slate-200 focus:border-[#3D5A3D] transition-all px-4",
                  errors.owner_email && "border-red-500 focus:border-red-500",
                )}
              />
              {errors.owner_email && (
                <p className="text-[10px] text-red-500 font-bold tracking-tight">
                  {errors.owner_email.message}
                </p>
              )}
            </div>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full bg-[#3D5A3D] hover:bg-[#2E4A2E] h-14 text-lg font-bold shadow-xl shadow-[#3D5A3D]/20 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99]"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <CircleNotch className="h-6 w-6 animate-spin mr-3" />
              Establishing Organization...
            </>
          ) : (
            "Create Organization & Send Invite"
          )}
        </Button>
      </form>
    </div>
  );
}
