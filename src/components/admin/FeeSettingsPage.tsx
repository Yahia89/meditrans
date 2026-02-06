import React, { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  MapPin,
  Timer,
  Truck,
  Info,
  Calculator,
  Save,
  Loader2,
  Settings,
  ShieldCheck,
  ChevronRight,
  User,
  Clock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const feeSchema = z.object({
  base_fee: z.number().min(0, "Must be at least 0"),
  per_mile_fee: z.number().min(0, "Must be at least 0"),
  per_minute_wait_fee: z.number().min(0, "Must be at least 0"),
  discharge_fee: z.number().min(0, "Must be at least 0"),
});

type FeeFormData = z.infer<typeof feeSchema>;

export function FeeSettingsPage() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingData, setPendingData] = useState<FeeFormData | null>(null);

  const {
    data: fees,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ["organization_fees", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return null;
      // Joining with user_profiles to get the name of the person who last updated
      const { data, error } = await supabase
        .from("organization_fees")
        .select(
          `
          *,
          updated_by:user_profiles!updated_by_id(full_name)
        `,
        )
        .eq("org_id", currentOrganization.id)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!currentOrganization?.id,
    retry: 1,
  });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<FeeFormData>({
    resolver: zodResolver(feeSchema),
    defaultValues: {
      base_fee: 0,
      per_mile_fee: 0,
      per_minute_wait_fee: 0,
      discharge_fee: 0,
    },
  });

  React.useEffect(() => {
    if (fees) {
      reset({
        base_fee: Number(fees.base_fee) || 0,
        per_mile_fee: Number(fees.per_mile_fee) || 0,
        per_minute_wait_fee: Number(fees.per_minute_wait_fee) || 0,
        discharge_fee: Number(fees.discharge_fee) || 0,
      });
    }
  }, [fees, reset]);

  const updateMutation = useMutation({
    mutationFn: async (data: FeeFormData) => {
      if (!currentOrganization?.id || !user?.id) return;

      const { error } = await supabase.from("organization_fees").upsert(
        {
          org_id: currentOrganization.id,
          ...data,
          updated_by_id: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id" },
      );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["organization_fees", currentOrganization?.id],
      });
      toast.success("Fee schedule updated successfully");
      setShowConfirm(false);
    },
    onError: (error: any) => {
      console.error("Error updating fees:", error);
      toast.error(error.message || "Failed to update fees");
    },
  });

  const onSubmitHandler: SubmitHandler<FeeFormData> = (data) => {
    setPendingData(data);
    setShowConfirm(true);
  };

  const confirmSave = () => {
    if (pendingData) {
      updateMutation.mutate(pendingData);
    }
  };

  const watchedValues = watch();

  // Preview Calculation
  const previewDistance = 10;
  const previewWait = 5;
  const standardCost =
    (watchedValues.base_fee || 0) +
    previewDistance * (watchedValues.per_mile_fee || 0) +
    previewWait * (watchedValues.per_minute_wait_fee || 0);

  if (!currentOrganization) return null;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4 animate-in fade-in duration-500">
        <div className="relative">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Settings className="w-5 h-5 text-emerald-600 animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-lg font-bold text-slate-900">
            Synchronizing Fee Schedule
          </p>
          <p className="text-sm text-slate-500">
            Connecting to secure billing infrastructure...
          </p>
        </div>
      </div>
    );
  }

  if (queryError) {
    return (
      <div className="max-w-2xl mx-auto mt-20 p-8 bg-red-50 rounded-2xl border border-red-100 text-center space-y-4 shadow-sm animate-in zoom-in-95 duration-300">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Info className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-red-900">
          Database Connection Error
        </h2>
        <p className="text-red-700 leading-relaxed">
          We are unable to reach the fee schedule table. This usually indicates
          that the database migration needs to be applied to your project.
        </p>
        <div className="pt-4 flex justify-center gap-3">
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="border-red-200 hover:bg-red-100 text-red-700"
          >
            Retry Connection
          </Button>
          <Button className="bg-red-600 hover:bg-red-700 text-white" asChild>
            <a
              href="https://supabase.com/dashboard/project/devszzjyobijwldayicb/sql"
              target="_blank"
              rel="noreferrer"
            >
              Open SQL Editor
            </a>
          </Button>
        </div>
        <p className="text-xs text-red-400 font-mono mt-4">
          Error: {queryError.message}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold uppercase tracking-wider border border-emerald-100/50 shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5" />
            Administrative Settings
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-none">
            Fee Schedule
          </h1>
          <p className="text-slate-500 text-base md:text-lg max-w-2xl font-medium leading-relaxed">
            Configure how {currentOrganization.name} calculates trip estimates
            and patient billing rates.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          {fees?.updated_at && (
            <div className="text-right space-y-1 mb-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center justify-end gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <User className="w-3 h-3 text-emerald-600" />
                Last Modified By
              </div>
              <div className="text-sm font-bold text-slate-900">
                {fees.updated_by?.full_name || "System Administrator"}
              </div>
              <div className="flex items-center justify-end gap-1.5 text-[10px] text-slate-400 font-medium">
                <Clock className="w-3 h-3" />
                {format(new Date(fees.updated_at), "MMM d, yyyy 'at' h:mm a")}
              </div>
            </div>
          )}
          <Button
            onClick={handleSubmit(onSubmitHandler)}
            disabled={!isDirty || updateMutation.isPending}
            className="bg-[#3D5A3D] hover:bg-[#2E4A2E] text-white gap-2 px-8 h-14 text-sm font-bold rounded-2xl shadow-xl shadow-slate-200 transition-all hover:-translate-y-0.5"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Save Configuration
          </Button>
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmitHandler)}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
      >
        <div className="lg:col-span-8 space-y-8">
          <Card className="border-none shadow-2xl shadow-slate-200/60 bg-white rounded-[2rem] overflow-hidden group">
            <CardHeader className="bg-slate-50/50 p-8 border-b border-slate-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-400 group-hover:text-emerald-500 transition-colors">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-slate-900">
                    Variable Rate Components
                  </CardTitle>
                  <CardDescription className="text-slate-500 font-medium">
                    Primary factors for service pricing.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {/* Base Fee */}
                <div className="p-8 hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                          <Truck className="w-4 h-4" />
                        </div>
                        <Label className="text-lg font-bold text-slate-800 whitespace-nowrap">
                          Base Pickup Fee
                        </Label>
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase shrink-0">
                          Standard
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 leading-relaxed max-w-lg italic">
                        The initial mobilization fee applied at trip
                        commencement.
                      </p>
                    </div>
                    <div className="w-full md:w-48 group/input">
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold group-focus-within/input:text-emerald-500 pointer-events-none">
                          $
                        </span>
                        <Input
                          {...register("base_fee", { valueAsNumber: true })}
                          type="number"
                          step="0.01"
                          className="pl-8 h-14 text-xl bg-slate-100/50 border-transparent focus:border-emerald-500/30 focus:bg-white transition-all font-mono font-bold text-slate-900 rounded-xl"
                        />
                      </div>
                      {errors.base_fee && (
                        <p className="text-[10px] text-red-500 font-bold mt-1.5 px-1 animate-pulse">
                          {errors.base_fee.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Per Mile Fee */}
                <div className="p-8 hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <Label className="text-lg font-bold text-slate-800 whitespace-nowrap">
                          Mileage Rate (Per Mile)
                        </Label>
                        <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full uppercase shrink-0">
                          Dynamic
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 leading-relaxed max-w-lg italic">
                        Cost applied per mile driven with the client onboard.
                      </p>
                    </div>
                    <div className="w-full md:w-48 group/input">
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold group-focus-within/input:text-emerald-500 pointer-events-none">
                          $
                        </span>
                        <Input
                          {...register("per_mile_fee", { valueAsNumber: true })}
                          type="number"
                          step="0.01"
                          className="pl-8 h-14 text-xl bg-slate-100/50 border-transparent focus:border-emerald-500/30 focus:bg-white transition-all font-mono font-bold text-slate-900 rounded-xl"
                        />
                      </div>
                      {errors.per_mile_fee && (
                        <p className="text-[10px] text-red-500 font-bold mt-1.5 px-1 animate-pulse">
                          {errors.per_mile_fee.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Per Min Wait */}
                <div className="p-8 hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                          <Timer className="w-4 h-4" />
                        </div>
                        <Label className="text-lg font-bold text-slate-800 whitespace-nowrap">
                          Wait Time Rate (Per Minute)
                        </Label>
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase shrink-0">
                          Variable
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 leading-relaxed max-w-lg italic">
                        Charged for inactive wait time during appointments.
                      </p>
                    </div>
                    <div className="w-full md:w-48 group/input">
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold group-focus-within/input:text-emerald-500 pointer-events-none">
                          $
                        </span>
                        <Input
                          {...register("per_minute_wait_fee", {
                            valueAsNumber: true,
                          })}
                          type="number"
                          step="0.01"
                          className="pl-8 h-14 text-xl bg-slate-100/50 border-transparent focus:border-emerald-500/30 focus:bg-white transition-all font-mono font-bold text-slate-900 rounded-xl"
                        />
                      </div>
                      {errors.per_minute_wait_fee && (
                        <p className="text-[10px] text-red-500 font-bold mt-1.5 px-1 animate-pulse">
                          {errors.per_minute_wait_fee.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Discharge Fee */}
                <div className="p-8 hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                          <Info className="w-4 h-4" />
                        </div>
                        <Label className="text-lg font-bold text-slate-800 whitespace-nowrap">
                          Discharge Flat Rate
                        </Label>
                        <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full uppercase shrink-0">
                          Facility
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 leading-relaxed max-w-lg italic">
                        Fixed rate for facility discharge hospitalizations.
                      </p>
                    </div>
                    <div className="w-full md:w-48 group/input">
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold group-focus-within/input:text-emerald-500 pointer-events-none">
                          $
                        </span>
                        <Input
                          {...register("discharge_fee", {
                            valueAsNumber: true,
                          })}
                          type="number"
                          step="0.01"
                          className="pl-8 h-14 text-xl bg-slate-100/50 border-transparent focus:border-emerald-500/30 focus:bg-white transition-all font-mono font-bold text-slate-900 rounded-xl"
                        />
                      </div>
                      {errors.discharge_fee && (
                        <p className="text-[10px] text-red-500 font-bold mt-1.5 px-1 animate-pulse">
                          {errors.discharge_fee.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card className="border-none shadow-2xl shadow-emerald-900/10 bg-[#0A2619] text-white rounded-[2rem] overflow-hidden">
            <CardHeader className="p-8 pb-4">
              <div className="flex items-center gap-2 text-emerald-400 mb-1">
                <Calculator className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
                  Calculator
                </span>
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight leading-7">
                Estimative <br /> Billing Forecast
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-4 space-y-8">
              <div className="grid grid-cols-2 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5">
                <div className="p-4 bg-white/[0.02]">
                  <div className="text-[10px] text-emerald-400/60 uppercase font-bold mb-1">
                    Distance
                  </div>
                  <div className="text-xl font-bold font-mono tracking-tight">
                    {previewDistance} mi
                  </div>
                </div>
                <div className="p-4 bg-white/[0.02]">
                  <div className="text-[10px] text-emerald-400/60 uppercase font-bold mb-1">
                    Wait Time
                  </div>
                  <div className="text-xl font-bold font-mono tracking-tight">
                    {previewWait} min
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex flex-col gap-1 items-end group">
                  <span className="text-xs text-emerald-100/40 uppercase font-bold tracking-widest">
                    Standard Trip Total
                  </span>
                  <span className="text-5xl font-black text-white font-mono drop-shadow-lg scale-100 group-hover:scale-110 transition-transform origin-right">
                    ${standardCost.toFixed(2)}
                  </span>
                </div>
                <div className="h-px bg-white/5" />
                <div className="flex justify-between items-center group">
                  <span className="text-xs text-white/50 font-bold uppercase tracking-widest">
                    Discharge Flat
                  </span>
                  <span className="text-2xl font-bold text-emerald-200 font-mono group-hover:translate-x-[-4px] transition-transform">
                    ${(watchedValues.discharge_fee || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="p-5 bg-white/[0.03] rounded-[1.5rem] flex gap-3 items-start border border-white/[0.02]">
                <Info className="w-5 h-5 text-emerald-400/60 shrink-0 mt-0.5" />
                <p className="text-[11px] text-emerald-100/40 leading-relaxed font-medium">
                  This simulation uses current rate configurations. Actual
                  invoice totals may fluctuate based on dynamic routing
                  variables and facility requirements.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl shadow-slate-200/50 bg-slate-50 rounded-[1.5rem]">
            <CardHeader className="p-6 pb-2">
              <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                Integration Log
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Adjustments to the fee schedule are recorded in the audit trail
                and applied globally to all prospective trip quote requests.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                  <ChevronRight className="w-3 h-3 text-emerald-500" />
                  Real-time propagation enabled
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                  <ChevronRight className="w-3 h-3 text-emerald-500" />
                  Estimate engine sync active
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black text-slate-900">
              Confirm Fee Schedule Update?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 text-base leading-relaxed">
              You are about to modify the core billing parameters for{" "}
              <strong>{currentOrganization.name}</strong>. These changes will
              take effect immediately for all new trip estimates and invoices.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-xl border-slate-200 font-bold hover:bg-slate-50">
              Review Changes
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSave}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold px-8"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Confirm & Apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
