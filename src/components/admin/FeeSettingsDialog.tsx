import React from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Coins,
  MapPin,
  Timer,
  Truck,
  Info,
  Calculator,
  Save,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const feeSchema = z.object({
  base_fee: z.number().min(0, "Must be at least 0"),
  per_mile_fee: z.number().min(0, "Must be at least 0"),
  per_minute_wait_fee: z.number().min(0, "Must be at least 0"),
  discharge_fee: z.number().min(0, "Must be at least 0"),
});

type FeeFormData = z.infer<typeof feeSchema>;

interface FeeSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeeSettingsDialog({
  open,
  onOpenChange,
}: FeeSettingsDialogProps) {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();

  const { data: fees } = useQuery({
    queryKey: ["organization_fees", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return null;
      const { data, error } = await supabase
        .from("organization_fees")
        .select("*")
        .eq("org_id", currentOrganization.id)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!currentOrganization?.id && open,
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
      if (!currentOrganization?.id) return;

      const { error } = await supabase.from("organization_fees").upsert({
        org_id: currentOrganization.id,
        ...data,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["organization_fees", currentOrganization?.id],
      });
      toast.success("Fee schedule updated successfully");
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error("Error updating fees:", error);
      toast.error(error.message || "Failed to update fees");
    },
  });

  const onSubmit: SubmitHandler<FeeFormData> = (data) => {
    updateMutation.mutate(data);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] overflow-hidden border-none p-0 bg-slate-50">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Coins className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <DialogTitle className="text-xl">Fee Schedule</DialogTitle>
              <DialogDescription>
                Configure how trips are billed for {currentOrganization.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-slate-600">
                  <Truck className="w-4 h-4" /> Base Fee
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    $
                  </span>
                  <Input
                    {...register("base_fee", { valueAsNumber: true })}
                    type="number"
                    step="0.01"
                    className="pl-7 bg-white border-slate-200"
                    placeholder="0.00"
                  />
                </div>
                {errors.base_fee && (
                  <p className="text-xs text-red-500">
                    {errors.base_fee.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-slate-600">
                  <MapPin className="w-4 h-4" /> Per Mile Fee
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    $
                  </span>
                  <Input
                    {...register("per_mile_fee", { valueAsNumber: true })}
                    type="number"
                    step="0.01"
                    className="pl-7 bg-white border-slate-200"
                    placeholder="0.00"
                  />
                </div>
                {errors.per_mile_fee && (
                  <p className="text-xs text-red-500">
                    {errors.per_mile_fee.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-slate-600">
                  <Timer className="w-4 h-4" /> Per Min Wait
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    $
                  </span>
                  <Input
                    {...register("per_minute_wait_fee", {
                      valueAsNumber: true,
                    })}
                    type="number"
                    step="0.01"
                    className="pl-7 bg-white border-slate-200"
                    placeholder="0.00"
                  />
                </div>
                {errors.per_minute_wait_fee && (
                  <p className="text-xs text-red-500">
                    {errors.per_minute_wait_fee.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-slate-600">
                  <Info className="w-4 h-4" /> Discharge (Flat)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    $
                  </span>
                  <Input
                    {...register("discharge_fee", { valueAsNumber: true })}
                    type="number"
                    step="0.01"
                    className="pl-7 bg-white border-slate-200"
                    placeholder="0.00"
                  />
                </div>
                {errors.discharge_fee && (
                  <p className="text-xs text-red-500">
                    {errors.discharge_fee.message}
                  </p>
                )}
              </div>
            </div>

            <Card className="bg-emerald-50/50 border-emerald-100 shadow-none">
              <CardContent className="p-4 pt-4">
                <div className="flex items-center gap-2 mb-3 text-emerald-800 font-medium text-sm">
                  <Calculator className="w-4 h-4" />
                  Live Preview Calculation
                </div>
                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex justify-between border-b border-emerald-100/50 pb-2">
                    <span>Standard Trip (10 miles + 5m wait)</span>
                    <span className="font-bold text-emerald-700 font-mono">
                      ${standardCost.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Discharge Trip (Flat Rate)</span>
                    <span className="font-bold text-emerald-700 font-mono">
                      ${watchedValues.discharge_fee.toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter className="p-6 bg-white border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 min-w-[140px]"
              disabled={!isDirty || updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
