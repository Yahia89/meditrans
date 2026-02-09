import React, { useState } from "react";
import {
  useForm,
  useFieldArray,
  Controller,
  type SubmitHandler,
} from "react-hook-form";
import { cn } from "@/lib/utils";
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
  Calculator,
  Save,
  Loader2,
  ShieldCheck,
  User,
  Clock,
  Zap,
  Plus,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";

const customChargeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  amount: z.number().min(0, "Amount must be at least 0"),
  is_per_mile: z.boolean(),
});

const feeSchema = z.object({
  base_fee: z.number().min(0),
  per_mile_fee: z.number().min(0),
  deadhead_per_mile_ambulatory: z.number().min(0),

  foldable_wheelchair_base_fee: z.number().min(0),
  foldable_wheelchair_per_mile_fee: z.number().min(0),
  foldable_wheelchair_deadhead_fee: z.number().min(0),

  wheelchair_base_fee: z.number().min(0),
  wheelchair_per_mile_fee: z.number().min(0),
  wheelchair_deadhead_fee: z.number().min(0),

  ramp_van_base_fee: z.number().min(0),
  ramp_van_per_mile_fee: z.number().min(0),
  ramp_van_deadhead_fee: z.number().min(0),

  wait_time_free_minutes: z.number().min(0),
  wait_time_hourly_rate: z.number().min(0),

  custom_charges: z.array(customChargeSchema),
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
    control,
    formState: { isDirty },
  } = useForm<FeeFormData>({
    resolver: zodResolver(feeSchema),
    defaultValues: {
      base_fee: 26,
      per_mile_fee: 2,
      deadhead_per_mile_ambulatory: 1,

      foldable_wheelchair_base_fee: 40,
      foldable_wheelchair_per_mile_fee: 3,
      foldable_wheelchair_deadhead_fee: 1.5,

      wheelchair_base_fee: 40,
      wheelchair_per_mile_fee: 3,
      wheelchair_deadhead_fee: 1.5,

      ramp_van_base_fee: 40,
      ramp_van_per_mile_fee: 3,
      ramp_van_deadhead_fee: 1.5,

      wait_time_free_minutes: 45,
      wait_time_hourly_rate: 55,
      custom_charges: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "custom_charges",
  });

  React.useEffect(() => {
    if (fees) {
      reset({
        base_fee: Number(fees.base_fee) || 26,
        per_mile_fee: Number(fees.per_mile_fee) || 2,
        deadhead_per_mile_ambulatory:
          Number(fees.deadhead_per_mile_ambulatory) || 1,

        foldable_wheelchair_base_fee:
          Number(fees.foldable_wheelchair_base_fee) || 40,
        foldable_wheelchair_per_mile_fee:
          Number(fees.foldable_wheelchair_per_mile_fee) || 3,
        foldable_wheelchair_deadhead_fee:
          Number(fees.foldable_wheelchair_deadhead_fee) || 1.5,

        wheelchair_base_fee: Number(fees.wheelchair_base_fee) || 40,
        wheelchair_per_mile_fee: Number(fees.wheelchair_per_mile_fee) || 3,
        wheelchair_deadhead_fee: Number(fees.wheelchair_deadhead_fee) || 1.5,

        ramp_van_base_fee: Number(fees.ramp_van_base_fee) || 40,
        ramp_van_per_mile_fee: Number(fees.ramp_van_per_mile_fee) || 3,
        ramp_van_deadhead_fee: Number(fees.ramp_van_deadhead_fee) || 1.5,

        wait_time_free_minutes: Number(fees.wait_time_free_minutes) || 45,
        wait_time_hourly_rate: Number(fees.wait_time_hourly_rate) || 55,
        custom_charges: (Array.isArray(fees.custom_charges)
          ? fees.custom_charges
          : []
        ).map((charge: any) => ({
          name: String(charge.name || ""),
          amount: Number(charge.amount) || 0,
          is_per_mile: Boolean(charge.is_per_mile),
        })),
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
  const previewWaitMinutes = 60;

  const calculateEstimate = (base: number, perMile: number) => {
    // Wait time: flat rate if exceeds free minutes (not pro-rated)
    const freeMinutes = watchedValues.wait_time_free_minutes || 45;
    const waitFlatRate = watchedValues.wait_time_hourly_rate || 55;
    const waitCharge = previewWaitMinutes > freeMinutes ? waitFlatRate : 0;

    let customChargeTotal = 0;
    if (watchedValues.custom_charges) {
      watchedValues.custom_charges.forEach((charge: any) => {
        if (charge?.is_per_mile) {
          customChargeTotal += (Number(charge.amount) || 0) * previewDistance;
        } else {
          customChargeTotal += Number(charge?.amount) || 0;
        }
      });
    }

    return (
      (base || 0) +
      previewDistance * (perMile || 0) +
      waitCharge +
      customChargeTotal
    );
  };

  const ambulatoryEstimate = calculateEstimate(
    watchedValues.base_fee,
    watchedValues.per_mile_fee,
  );
  const foldableEstimate = calculateEstimate(
    watchedValues.foldable_wheelchair_base_fee,
    watchedValues.foldable_wheelchair_per_mile_fee,
  );
  const wheelchairEstimate = calculateEstimate(
    watchedValues.wheelchair_base_fee,
    watchedValues.wheelchair_per_mile_fee,
  );
  const rampVanEstimate = calculateEstimate(
    watchedValues.ramp_van_base_fee,
    watchedValues.ramp_van_per_mile_fee,
  );

  if (!currentOrganization) return null;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4 animate-in fade-in duration-500">
        <Loader2 className="w-12 h-12 animate-spin text-lime-600" />
        <p className="text-lg font-bold text-slate-900">
          Synchronizing Fee Schedule
        </p>
      </div>
    );
  }

  if (queryError) {
    return (
      <div className="max-w-2xl mx-auto mt-20 p-8 bg-red-50 rounded-[1.5rem] border border-red-100 text-center space-y-4 shadow-sm animate-in zoom-in-95 duration-300">
        <h2 className="text-2xl font-bold text-red-900">
          Database Connection Error
        </h2>
        <p className="text-red-700 leading-relaxed">
          We are unable to reach the fee schedule table. Please verify
          migrations.
        </p>
        <Button
          onClick={() => window.location.reload()}
          variant="outline"
          className="rounded-xl border-red-200 text-red-700 hover:bg-red-100"
        >
          Retry Connection
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-lime-50 text-lime-700 rounded-full text-[10px] font-bold uppercase tracking-wider border border-lime-100/50 shadow-sm">
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          {/* Category: Ambulatory */}
          <Card className="border-none shadow-xl shadow-slate-200/60 bg-white rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-slate-50/50 p-8 border-b border-slate-100">
              <CardTitle className="text-xl font-bold text-slate-900">
                Ambulatory (Common Carrier)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-slate-100">
              <div className="p-8 flex items-center justify-between gap-6">
                <div className="flex-1 space-y-1">
                  <Label className="text-lg font-bold text-slate-800">
                    Base Pickup Fee
                  </Label>
                  <p className="text-sm text-slate-400 italic">
                    Initial charge for standard patient transport.
                  </p>
                </div>
                <div className="w-40 relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    $
                  </span>
                  <Input
                    {...register("base_fee", { valueAsNumber: true })}
                    type="number"
                    step="0.01"
                    className="pl-8 h-12 text-xl bg-slate-50 border-transparent focus:bg-white rounded-xl font-mono font-bold"
                  />
                </div>
              </div>
              <div className="p-8 flex items-center justify-between gap-6">
                <div className="flex-1 space-y-1">
                  <Label className="text-lg font-bold text-slate-800">
                    Mileage Rate
                  </Label>
                  <p className="text-sm text-slate-400 italic">
                    Loaded rate per mile driven.
                  </p>
                </div>
                <div className="w-40 relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    $
                  </span>
                  <Input
                    {...register("per_mile_fee", { valueAsNumber: true })}
                    type="number"
                    step="0.01"
                    className="pl-8 h-12 text-xl bg-slate-50 border-transparent focus:bg-white rounded-xl font-mono font-bold"
                  />
                </div>
              </div>
              <div className="p-8 flex items-center justify-between gap-6">
                <div className="flex-1 space-y-1">
                  <Label className="text-lg font-bold text-slate-800">
                    Deadhead Rate
                  </Label>
                  <p className="text-sm text-slate-400 italic">
                    Rate per mile for empty mobilization.
                  </p>
                </div>
                <div className="w-40 relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    $
                  </span>
                  <Input
                    {...register("deadhead_per_mile_ambulatory", {
                      valueAsNumber: true,
                    })}
                    type="number"
                    step="0.01"
                    className="pl-8 h-12 text-xl bg-slate-50 border-transparent focus:bg-white rounded-xl font-mono font-bold"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Category: Foldable Wheelchair */}
          <Card className="border-none shadow-xl shadow-slate-200/60 bg-white rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-slate-50/50 p-8 border-b border-slate-100">
              <CardTitle className="text-xl font-bold text-slate-900">
                Foldable Wheelchair
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-slate-100">
              <div className="p-8 flex items-center justify-between gap-6">
                <div className="flex-1 space-y-1">
                  <Label className="text-lg font-bold text-slate-800">
                    Base Pickup Fee
                  </Label>
                  <p className="text-sm text-slate-400 italic">
                    Initial charge for foldable wheelchair transport.
                  </p>
                </div>
                <div className="w-40 relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    $
                  </span>
                  <Input
                    {...register("foldable_wheelchair_base_fee", {
                      valueAsNumber: true,
                    })}
                    type="number"
                    step="0.01"
                    className="pl-8 h-12 text-xl bg-slate-50 border-transparent focus:bg-white rounded-xl font-mono font-bold"
                  />
                </div>
              </div>
              <div className="p-8 flex items-center justify-between gap-6">
                <div className="flex-1 space-y-1">
                  <Label className="text-lg font-bold text-slate-800">
                    Mileage Rate
                  </Label>
                  <p className="text-sm text-slate-400 italic">
                    Rate per mile for foldable wheelchair.
                  </p>
                </div>
                <div className="w-40 relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    $
                  </span>
                  <Input
                    {...register("foldable_wheelchair_per_mile_fee", {
                      valueAsNumber: true,
                    })}
                    type="number"
                    step="0.01"
                    className="pl-8 h-12 text-xl bg-slate-50 border-transparent focus:bg-white rounded-xl font-mono font-bold"
                  />
                </div>
              </div>
              <div className="p-8 flex items-center justify-between gap-6">
                <div className="flex-1 space-y-1">
                  <Label className="text-lg font-bold text-slate-800">
                    Deadhead Rate
                  </Label>
                  <p className="text-sm text-slate-400 italic">
                    Empty mobilization for foldable wheelchair.
                  </p>
                </div>
                <div className="w-40 relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    $
                  </span>
                  <Input
                    {...register("foldable_wheelchair_deadhead_fee", {
                      valueAsNumber: true,
                    })}
                    type="number"
                    step="0.01"
                    className="pl-8 h-12 text-xl bg-slate-50 border-transparent focus:bg-white rounded-xl font-mono font-bold"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Category: Standard Wheelchair */}
          <Card className="border-none shadow-xl shadow-slate-200/60 bg-white rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-slate-50/50 p-8 border-b border-slate-100">
              <CardTitle className="text-xl font-bold text-slate-900">
                Wheel Chair (Standard)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-slate-100">
              <div className="p-8 flex items-center justify-between gap-6">
                <div className="flex-1 space-y-1">
                  <Label className="text-lg font-bold text-slate-800">
                    Wheelchair Pickup
                  </Label>
                  <p className="text-sm text-slate-400 italic">
                    Base fee for standard wheelchair transport.
                  </p>
                </div>
                <div className="w-40 relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    $
                  </span>
                  <Input
                    {...register("wheelchair_base_fee", {
                      valueAsNumber: true,
                    })}
                    type="number"
                    step="0.01"
                    className="pl-8 h-12 text-xl bg-slate-50 border-transparent focus:bg-white rounded-xl font-mono font-bold"
                  />
                </div>
              </div>
              <div className="p-8 flex items-center justify-between gap-6">
                <div className="flex-1 space-y-1">
                  <Label className="text-lg font-bold text-slate-800">
                    Wheelchair Per Mile
                  </Label>
                  <p className="text-sm text-slate-400 italic">
                    Mileage rate for standard wheelchair.
                  </p>
                </div>
                <div className="w-40 relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    $
                  </span>
                  <Input
                    {...register("wheelchair_per_mile_fee", {
                      valueAsNumber: true,
                    })}
                    type="number"
                    step="0.01"
                    className="pl-8 h-12 text-xl bg-slate-50 border-transparent focus:bg-white rounded-xl font-mono font-bold"
                  />
                </div>
              </div>
              <div className="p-8 flex items-center justify-between gap-6">
                <div className="flex-1 space-y-1">
                  <Label className="text-lg font-bold text-slate-800">
                    Deadhead Rate
                  </Label>
                  <p className="text-sm text-slate-400 italic">
                    Empty mobilization for standard wheelchair.
                  </p>
                </div>
                <div className="w-40 relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    $
                  </span>
                  <Input
                    {...register("wheelchair_deadhead_fee", {
                      valueAsNumber: true,
                    })}
                    type="number"
                    step="0.01"
                    className="pl-8 h-12 text-xl bg-slate-50 border-transparent focus:bg-white rounded-xl font-mono font-bold"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Category: Ramp Van */}
          <Card className="border-none shadow-xl shadow-slate-200/60 bg-white rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-slate-50/50 p-8 border-b border-slate-100">
              <CardTitle className="text-xl font-bold text-slate-900">
                Ramp Van
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-slate-100">
              <div className="p-8 flex items-center justify-between gap-6">
                <div className="flex-1 space-y-1">
                  <Label className="text-lg font-bold text-slate-800">
                    Base Pickup Fee
                  </Label>
                  <p className="text-sm text-slate-400 italic">
                    Base fee for ramp-equipped specialized vans.
                  </p>
                </div>
                <div className="w-40 relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    $
                  </span>
                  <Input
                    {...register("ramp_van_base_fee", {
                      valueAsNumber: true,
                    })}
                    type="number"
                    step="0.01"
                    className="pl-8 h-12 text-xl bg-slate-50 border-transparent focus:bg-white rounded-xl font-mono font-bold"
                  />
                </div>
              </div>
              <div className="p-8 flex items-center justify-between gap-6">
                <div className="flex-1 space-y-1">
                  <Label className="text-lg font-bold text-slate-800">
                    Mileage Rate
                  </Label>
                  <p className="text-sm text-slate-400 italic">
                    Premium mileage rate for ramp van.
                  </p>
                </div>
                <div className="w-40 relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    $
                  </span>
                  <Input
                    {...register("ramp_van_per_mile_fee", {
                      valueAsNumber: true,
                    })}
                    type="number"
                    step="0.01"
                    className="pl-8 h-12 text-xl bg-slate-50 border-transparent focus:bg-white rounded-xl font-mono font-bold"
                  />
                </div>
              </div>
              <div className="p-8 flex items-center justify-between gap-6">
                <div className="flex-1 space-y-1">
                  <Label className="text-lg font-bold text-slate-800">
                    Deadhead Rate
                  </Label>
                  <p className="text-sm text-slate-400 italic">
                    Empty mobilization for ramp van.
                  </p>
                </div>
                <div className="w-40 relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    $
                  </span>
                  <Input
                    {...register("ramp_van_deadhead_fee", {
                      valueAsNumber: true,
                    })}
                    type="number"
                    step="0.01"
                    className="pl-8 h-12 text-xl bg-slate-50 border-transparent focus:bg-white rounded-xl font-mono font-bold"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Category: Wait Time */}
          <Card className="border-none shadow-xl shadow-slate-200/60 bg-white rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-slate-50/50 p-8 border-b border-slate-100">
              <CardTitle className="text-xl font-bold text-slate-900">
                Wait Time & Hourly Policy
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-slate-100">
              <div className="p-8 flex items-center justify-between gap-6">
                <div className="flex-1 space-y-1">
                  <Label className="text-lg font-bold text-slate-800">
                    Free Wait Allowance (Time)
                  </Label>
                  <p className="text-sm text-slate-400 italic">
                    Minutes included before hourly billing begins.
                  </p>
                </div>
                <div className="w-40 relative">
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px] uppercase">
                    min
                  </span>
                  <Input
                    {...register("wait_time_free_minutes", {
                      valueAsNumber: true,
                    })}
                    type="number"
                    className="pr-12 h-12 text-xl bg-slate-50 border-transparent focus:bg-white rounded-xl font-mono font-bold"
                  />
                </div>
              </div>
              <div className="p-8 flex items-center justify-between gap-6">
                <div className="flex-1 space-y-1">
                  <Label className="text-lg font-bold text-slate-800">
                    Hourly Wait Rate
                  </Label>
                  <p className="text-sm text-slate-400 italic">
                    Rate per hour after free allowance.
                  </p>
                </div>
                <div className="w-40 relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    $
                  </span>
                  <Input
                    {...register("wait_time_hourly_rate", {
                      valueAsNumber: true,
                    })}
                    type="number"
                    step="0.01"
                    className="pl-8 h-12 text-xl bg-slate-50 border-transparent focus:bg-white rounded-xl font-mono font-bold"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Custom Charges Section */}
          <Card className="border-none shadow-xl shadow-slate-200/60 bg-white rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-slate-50/50 p-8 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-slate-900">
                  Custom Charges
                </CardTitle>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  append({ name: "", amount: 0, is_per_mile: false })
                }
                className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 font-bold"
              >
                <Plus className="w-4 h-4 mr-2 text-lime-600" />
                Add Charge
              </Button>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-slate-100">
              {fields.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-medium">
                  No custom charges configured.
                </div>
              ) : (
                fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="p-8 flex items-start gap-6 group"
                  >
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-sm font-bold text-slate-600">
                          Charge Name
                        </Label>
                        <Input
                          {...register(`custom_charges.${index}.name`)}
                          placeholder="e.g. Oxygen Tank"
                          className="h-11 bg-slate-50 border-transparent focus:bg-white rounded-xl font-medium"
                        />
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1 space-y-2 text-left">
                          <Label className="text-sm font-bold text-slate-600">
                            Amount
                          </Label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                              $
                            </span>
                            <Input
                              {...register(`custom_charges.${index}.amount`, {
                                valueAsNumber: true,
                              })}
                              type="number"
                              step="0.01"
                              className="pl-8 h-11 bg-slate-50 border-transparent focus:bg-white rounded-xl font-mono font-bold"
                            />
                          </div>
                        </div>
                        <div className="space-y-2 text-left w-48">
                          <Label className="text-sm font-bold text-slate-600">
                            Charging Type
                          </Label>
                          <Controller
                            control={control}
                            name={`custom_charges.${index}.is_per_mile`}
                            render={({ field }) => (
                              <ChargeTypeSelector
                                value={field.value}
                                onChange={field.onChange}
                              />
                            )}
                          />
                        </div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => remove(index)}
                      className="mt-8 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4">
          <div className="sticky top-8 space-y-6">
            <Card className="border-none shadow-2xl shadow-emerald-900/10 bg-[#0A2619] text-white rounded-[2rem] overflow-hidden">
              <CardHeader className="p-8 pb-4">
                <div className="flex items-center gap-2 text-lime-400 mb-1">
                  <Calculator className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">
                    Forecast Engine
                  </span>
                </div>
                <CardTitle className="text-2xl font-bold tracking-tight">
                  Billing Forecast
                </CardTitle>
                <p className="text-xs text-white/40">10 mi trip • 1 hr wait</p>
              </CardHeader>
              <CardContent className="p-8 pt-4 space-y-8">
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest text-left">
                      Ambulatory
                    </div>
                    <span className="text-2xl font-black text-white font-mono">
                      ${ambulatoryEstimate.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div className="text-[10px] font-bold text-lime-500 uppercase tracking-widest text-left">
                      Foldable WC
                    </div>
                    <span className="text-2xl font-black text-lime-400 font-mono">
                      ${foldableEstimate.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest text-left">
                      Standard WC
                    </div>
                    <span className="text-2xl font-black text-emerald-200 font-mono">
                      ${wheelchairEstimate.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest text-left">
                      Ramp Van
                    </div>
                    <span className="text-2xl font-black text-emerald-300 font-mono">
                      ${rampVanEstimate.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="p-5 bg-white/[0.03] rounded-[1.5rem] flex gap-3 items-start border border-white/[0.02]">
                  <Zap className="w-5 h-5 text-lime-400/40 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-white/30 leading-relaxed">
                    Estimates assume 1 hour of wait time (applying the{" "}
                    {watchedValues.wait_time_free_minutes}m allowance) and 10
                    miles, including any active custom charges.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="p-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] space-y-3">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                Infrastructure
              </h4>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Rate adjustments are propagated globally. Trip quotes will sync
                with these parameters in real-time.
              </p>
            </div>

            {/* Floating Save Action Block */}
            <div className="p-8 bg-white border border-slate-100 rounded-[2rem] shadow-xl shadow-slate-200/50 space-y-6">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Calculator className="w-3.5 h-3.5 text-lime-600" />
                  Status & Review
                </h4>

                {fees?.updated_at && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Last Saved By
                      </span>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <User className="w-3.5 h-3.5 text-lime-600" />
                        {fees.updated_by?.full_name || "System Admin"}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Last Updated
                      </span>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        {format(new Date(fees.updated_at), "MMM d, h:mm a")}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Button
                onClick={handleSubmit(onSubmitHandler)}
                disabled={!isDirty || updateMutation.isPending}
                className="w-full bg-[#3D5A3D] hover:bg-[#2E4A2E] text-white h-14 text-sm font-bold rounded-[1.2rem] shadow-lg shadow-emerald-900/10 transition-all hover:scale-[1.02] flex items-center justify-center gap-3"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                Save changes
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl p-10">
          <AlertDialogHeader className="space-y-4">
            <AlertDialogTitle className="text-3xl font-black text-slate-900 leading-tight">
              Apply Changes?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 text-lg leading-relaxed">
              You are updating the financial model for{" "}
              <strong>{currentOrganization.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-4">
            <AlertDialogCancel className="h-12 rounded-2xl border-slate-200 font-bold px-8">
              Review
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSave}
              className="h-12 rounded-2xl bg-[#3D5A3D] hover:bg-[#2E4A2E] font-bold px-10"
            >
              Update Rates
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ChargeTypeSelector({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (val: boolean) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full h-11 justify-between rounded-xl bg-slate-50 border-transparent hover:bg-white hover:border-slate-200 transition-all font-bold text-xs uppercase tracking-wider text-slate-700"
        >
          {value ? "Per Mile" : "Per Whole Trip"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0 rounded-xl border-slate-100 shadow-xl">
        <Command>
          <CommandList>
            <CommandGroup>
              <CommandItem
                value="per-whole-trip"
                onSelect={() => {
                  onChange(false);
                  setOpen(false);
                }}
                className="cursor-pointer rounded-lg py-3 text-xs font-bold uppercase tracking-wider"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    !value ? "opacity-100" : "opacity-0",
                  )}
                />
                Per Whole Trip
              </CommandItem>
              <CommandItem
                value="per-mile"
                onSelect={() => {
                  onChange(true);
                  setOpen(false);
                }}
                className="cursor-pointer rounded-lg py-3 text-xs font-bold uppercase tracking-wider"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value ? "opacity-100" : "opacity-0",
                  )}
                />
                Per Mile
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
