import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Building2,
  CreditCard,
  Globe,
  CheckCircle2,
  Info,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/lib/supabase";
import { Checkbox } from "@/components/ui/checkbox";

const billingSchema = z.object({
  npi: z
    .string()
    .length(10, "NPI must be exactly 10 digits")
    .regex(/^\d+$/, "NPI must only contain digits"),
  tax_id: z.string().min(9, "Tax ID must be at least 9 characters"),
  billing_state: z.enum(["MN", "CA"]),
  billing_enabled: z.boolean(),
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
      billing_state:
        (currentOrganization?.billing_state as "MN" | "CA") || "MN",
      billing_enabled: currentOrganization?.billing_enabled || false,
    },
  });

  const billingEnabled = watch("billing_enabled");

  React.useEffect(() => {
    if (currentOrganization) {
      reset({
        npi: currentOrganization.npi || "",
        tax_id: currentOrganization.tax_id || "",
        billing_state:
          (currentOrganization.billing_state as "MN" | "CA") || "MN",
        billing_enabled: currentOrganization.billing_enabled || false,
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
          billing_state: data.billing_state,
          billing_enabled: data.billing_enabled,
        })
        .eq("id", currentOrganization.id);

      if (error) throw error;

      await refreshOrganization();
      alert("Billing settings updated successfully");
    } catch (error: any) {
      console.error("Error updating billing settings:", error);
      alert(error.message || "Failed to update billing settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-emerald-600" />
          Medicaid Billing Setup
        </h1>
        <p className="text-slate-500">
          Configure your organization's credentials for direct Medicaid 837P
          electronic claim filing.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-500" />
                  Provider Identification
                </CardTitle>
                <CardDescription>
                  Your official billing credentials used in X12 837P segments.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                <Checkbox
                  checked={billingEnabled}
                  onCheckedChange={(checked) =>
                    setValue("billing_enabled", checked === true, {
                      shouldDirty: true,
                    })
                  }
                />
                <span
                  className={`text-xs font-medium ${
                    billingEnabled ? "text-emerald-600" : "text-slate-400"
                  }`}
                >
                  {billingEnabled ? "Billing Active" : "Billing Paused"}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                  National Provider Identifier (NPI)
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                </label>
                <Input
                  {...register("npi")}
                  placeholder="10-digit NPI number"
                  className={
                    errors.npi ? "border-red-300 focus:ring-red-500" : ""
                  }
                />
                {errors.npi && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.npi.message}
                  </p>
                )}
                <p className="text-[11px] text-slate-400">
                  Used in segments: ISA06, GS02, NM1*85*XX
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                  Tax Identification Number (TIN/EIN)
                </label>
                <Input
                  {...register("tax_id")}
                  placeholder="XX-XXXXXXX"
                  className={
                    errors.tax_id ? "border-red-300 focus:ring-red-500" : ""
                  }
                />
                {errors.tax_id && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.tax_id.message}
                  </p>
                )}
                <p className="text-[11px] text-slate-400">
                  Used in segments: ISA05, GS02, REF*EI
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                  Primary Billing State
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                </label>
                <Select
                  value={watch("billing_state")}
                  onValueChange={(value) =>
                    setValue("billing_state", value as "MN" | "CA", {
                      shouldDirty: true,
                    })
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MN">Minnesota (MN-ITS)</SelectItem>
                    <SelectItem value="CA">California (Medi-Cal)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1 bg-slate-50 p-2 rounded border border-slate-100 italic">
                  {watch("billing_state") === "MN"
                    ? "Claims will be formatted for Minnesota DHS using UMPI fallback logic."
                    : "Claims will be formatted for Medi-Cal with authorization segment support."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 flex gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-emerald-900">
              Trading Partner Agreement
            </h4>
            <p className="text-xs text-emerald-700 leading-relaxed">
              By enabling billing, you certify that your organization has a
              valid Trading Partner Agreement with{" "}
              {watch("billing_state") === "MN" ? "Minnesota DHS" : "Medi-Cal"}.
              Direct electronic filing requires active credentials in their
              respective production environment.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => reset()}
            disabled={!isDirty || isSaving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!isDirty || isSaving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Save Settings
              </span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
