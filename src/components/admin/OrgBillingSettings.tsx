import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Buildings,
  Info,
  ShieldCheck,
  HardDrive,
  Lock,
  CheckCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/lib/supabase";
import { Checkbox } from "@/components/ui/checkbox";

const billingSchema = z.object({
  npi: z
    .string()
    .length(10, "NPI must be exactly 10 digits")
    .regex(/^\d+$/, "NPI must only contain digits"),
  tax_id: z.string().min(9, "Tax ID must be at least 9 characters"),
  billing_enabled: z.boolean(),
  sftp_enabled: z.boolean(),
  sftp_host: z.string().optional(),
  sftp_username: z.string().optional(),
  sftp_password_enc: z.string().optional(),
  mn_its_submitter_id: z.string().optional(),
});

type BillingFormData = z.infer<typeof billingSchema>;

export function OrgbillingSettings() {
  const { currentOrganization, refreshOrganization } = useOrganization();
  const [isSaving, setIsSaving] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
    reset,
  } = useForm<BillingFormData>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      npi: currentOrganization?.npi || "",
      tax_id: currentOrganization?.tax_id || "",
      billing_enabled: currentOrganization?.billing_enabled ?? true,
      sftp_enabled: currentOrganization?.sftp_enabled || false,
      sftp_host: currentOrganization?.sftp_host || "",
      sftp_username: currentOrganization?.sftp_username || "",
      sftp_password_enc: "",
      mn_its_submitter_id: currentOrganization?.mn_its_submitter_id || "",
    },
  });

  const sftpEnabled = watch("sftp_enabled");

  React.useEffect(() => {
    if (currentOrganization) {
      reset({
        npi: currentOrganization.npi || "",
        tax_id: currentOrganization.tax_id || "",
        billing_enabled: currentOrganization.billing_enabled ?? true,
        sftp_enabled: currentOrganization.sftp_enabled || false,
        sftp_host: currentOrganization.sftp_host || "",
        sftp_username: currentOrganization.sftp_username || "",
        sftp_password_enc: "",
        mn_its_submitter_id: currentOrganization.mn_its_submitter_id || "",
      });
    }
  }, [currentOrganization, reset]);

  const onSubmit = async (data: BillingFormData) => {
    if (!currentOrganization?.id) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          npi: data.npi,
          tax_id: data.tax_id,
          billing_enabled: data.billing_enabled,
          sftp_enabled: data.sftp_enabled,
          sftp_host: data.sftp_host,
          sftp_username: data.sftp_username,
          mn_its_submitter_id: data.mn_its_submitter_id,
          ...(data.sftp_password_enc && {
            sftp_password_enc: data.sftp_password_enc,
          }),
        })
        .eq("id", currentOrganization.id);

      if (error) throw error;

      await refreshOrganization();
      alert("Billing setup updated successfully");
    } catch (error: any) {
      console.error("Error updating billing settings:", error);
      alert(error.message || "Failed to update billing settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto p-4 sm:p-6 bg-transparent">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Medicaid Billing Setup
        </h1>
        <p className="text-slate-500 text-sm">
          Configure electronic claim filing credentials and automated submission
          routes.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <Card className="border-slate-200/60 shadow-none overflow-hidden bg-white/50 backdrop-blur-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Buildings
                    size={20}
                    weight="duotone"
                    className="text-slate-400"
                  />
                  Provider Identity
                </CardTitle>
                <CardDescription className="text-xs">
                  Official credentials used for X12 837P transmission.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  NPI (National Provider ID)
                </label>
                <Input
                  {...register("npi")}
                  placeholder="10-digit NPI number"
                  className="bg-white border-slate-200 h-10 shadow-none focus-visible:ring-slate-400"
                />
                {errors.npi && (
                  <p className="text-[10px] text-red-500 font-medium">
                    {errors.npi.message}
                  </p>
                )}
                <p className="text-[10px] text-slate-400 font-medium">
                  Mapped to NM1*85*XX segments
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Tax ID (TIN/EIN)
                </label>
                <Input
                  {...register("tax_id")}
                  placeholder="XX-XXXXXXX"
                  className="bg-white border-slate-200 h-10 shadow-none focus-visible:ring-slate-400"
                />
                {errors.tax_id && (
                  <p className="text-[10px] text-red-500 font-medium">
                    {errors.tax_id.message}
                  </p>
                )}
                <p className="text-[10px] text-slate-400 font-medium">
                  Mapped to REF*EI segments
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/60 shadow-none overflow-hidden bg-white/50 backdrop-blur-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <HardDrive
                    size={20}
                    weight="duotone"
                    className="text-slate-400"
                  />
                  Automated Submission (SFTP)
                </CardTitle>
                <CardDescription className="text-xs">
                  Connect directly to MN-ITS or supported state gateways.
                </CardDescription>
              </div>
              <Checkbox
                checked={sftpEnabled}
                onCheckedChange={(checked) =>
                  setValue("sftp_enabled", checked === true, {
                    shouldDirty: true,
                  })
                }
              />
            </div>
          </CardHeader>
          <CardContent
            className={`p-6 space-y-8 transition-all duration-200 ${!sftpEnabled ? "opacity-40 grayscale pointer-events-none scale-[0.98]" : ""}`}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Submitter ID
                </label>
                <Input
                  {...register("mn_its_submitter_id")}
                  placeholder="e.g. 12345678"
                  className="bg-white border-slate-200 h-10 shadow-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  SFTP Host
                </label>
                <Input
                  {...register("sftp_host")}
                  placeholder="sftp.dhs.state.mn.us"
                  className="bg-white border-slate-200 h-10 shadow-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Username
                </label>
                <Input
                  {...register("sftp_username")}
                  placeholder="SFTP user account"
                  className="bg-white border-slate-200 h-10 shadow-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  Password
                  <Lock size={12} weight="duotone" />
                </label>
                <Input
                  {...register("sftp_password_enc")}
                  type="password"
                  placeholder="••••••••"
                  className="bg-white border-slate-200 h-10 shadow-none"
                />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex gap-3 text-slate-300">
              <Info
                size={20}
                weight="duotone"
                className="text-slate-400 shrink-0"
              />
              <p className="text-[11px] leading-relaxed">
                <span className="text-white font-bold">Automation Policy:</span>{" "}
                When active, batches are transmitted every Tuesday and Thursday.
                999 acknowledgements are automatically ingested 4 hours
                post-submission.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 flex gap-4">
          <ShieldCheck
            size={24}
            weight="duotone"
            className="text-emerald-600 shrink-0"
          />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-emerald-900 leading-none">
              Certification Required
            </h4>
            <p className="text-xs text-emerald-800/80 leading-relaxed">
              By configuring these settings, you certify that you have an active
              Trading Partner Agreement with the state. The system will operate
              in "Direct-to-State" mode, bypassing external clearinghouses.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={() => reset()}
            disabled={!isDirty || isSaving}
            className="text-slate-500 hover:bg-slate-100"
          >
            Reset
          </Button>
          <Button
            type="submit"
            disabled={!isDirty || isSaving}
            className="bg-slate-900 hover:bg-slate-800 text-white min-w-[140px] h-11 font-bold shadow-lg shadow-slate-900/10"
          >
            {isSaving ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saving...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <CheckCircle size={18} weight="duotone" />
                <span>Save Changes</span>
              </div>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
