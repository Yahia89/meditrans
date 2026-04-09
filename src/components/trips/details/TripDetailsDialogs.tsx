import type { Trip, TripStatus } from "../types";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Warning, Path, Timer } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import React, { useState, useEffect } from "react";

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip;
  onConfirm: () => void;
}

export function DeleteConfirmationDialog({
  isOpen,
  onOpenChange,
  trip,
  onConfirm,
}: DeleteConfirmationDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl border-slate-200">
        <AlertDialogHeader>
          <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
            <Warning weight="duotone" className="w-6 h-6 text-red-600" />
          </div>
          <AlertDialogTitle className="text-xl font-bold text-slate-900">
            Delete Trip?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-600">
            This action cannot be undone. This will permanently delete the
            trip for
            <span className="font-bold text-slate-900 ml-1">
              {trip.patient?.full_name}
            </span>
            .
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6 gap-3">
          <AlertDialogCancel className="rounded-xl border-slate-200 font-bold h-11">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold h-11 px-8 shadow-lg shadow-red-200/50"
          >
            Delete Trip
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface StatusUpdateDialogProps {
  statusToUpdate: TripStatus | null;
  onClose: () => void;
  onConfirm: (data: { reason?: string; explanation?: string }) => void;
}

export function StatusUpdateDialog({
  statusToUpdate,
  onClose,
  onConfirm,
}: StatusUpdateDialogProps) {
  const [cancelReason, setCancelReason] = useState<string>("");
  const [cancelExplanation, setCancelExplanation] = useState<string>("");

  useEffect(() => {
    if (!statusToUpdate) {
      setCancelReason("");
      setCancelExplanation("");
    }
  }, [statusToUpdate]);

  const handleConfirm = () => {
    onConfirm({
      reason: statusToUpdate === "cancelled" ? cancelReason : undefined,
      explanation:
        statusToUpdate === "cancelled" && cancelReason === "other"
          ? cancelExplanation
          : undefined,
    });
  };

  return (
    <Dialog
      open={!!statusToUpdate}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {statusToUpdate === "cancelled"
              ? "Cancel Trip"
              : "Mark as No Show"}
          </DialogTitle>
        </DialogHeader>

        <div className="py-6 space-y-6">
          {statusToUpdate === "cancelled" && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Cancellation Reason
              </label>
              <Select value={cancelReason} onValueChange={setCancelReason}>
                <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-slate-50/50">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                  <SelectItem value="late driver">Late Driver</SelectItem>
                  <SelectItem value="appointment cancel">
                    Appointment Canceled
                  </SelectItem>
                  <SelectItem value="other">Other (Explain)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {statusToUpdate === "cancelled" && cancelReason === "other" && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Explanation
              </label>
              <Textarea
                value={cancelExplanation}
                onChange={(e) => setCancelExplanation(e.target.value)}
                placeholder="Please explain why the trip is being canceled..."
                className="min-h-[100px] rounded-xl border-slate-200 bg-slate-50/50"
              />
            </div>
          )}

          <p className="text-sm text-slate-500 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
            {statusToUpdate === "cancelled"
              ? "Are you sure you want to cancel this trip? This action will notify relevant parties."
              : "Are you sure you want to mark this patient as a No Show? This will update the trip status."}
          </p>
        </div>

        <DialogFooter className="gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            className="rounded-xl font-bold text-slate-500 h-11"
          >
            Back
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              (statusToUpdate === "cancelled" && !cancelReason) ||
              (cancelReason === "other" && !cancelExplanation)
            }
            className={cn(
              "rounded-xl font-bold h-11 px-8 shadow-lg",
              statusToUpdate === "cancelled"
                ? "bg-red-600 hover:bg-red-700 text-white shadow-red-200/50"
                : "bg-orange-600 hover:bg-orange-700 text-white shadow-orange-200/50",
            )}
          >
            Confirm{" "}
            {statusToUpdate === "cancelled" ? "Cancellation" : "No Show"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditMileageDialog({
  isOpen,
  onOpenChange,
  trip,
  onConfirm,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip | null;
  onConfirm: (miles: number) => void;
}) {
  const [miles, setMiles] = useState<string>("");

  useEffect(() => {
    if (trip && isOpen) {
      setMiles(
        (trip.actual_distance_miles || trip.distance_miles || 0).toString(),
      );
    }
  }, [trip, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(parseFloat(miles));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Edit Trip Mileage</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Actual Distance (Miles)
            </label>
            <div className="relative">
              <Input
                type="number"
                step="0.1"
                required
                value={miles}
                onChange={(e) => setMiles(e.target.value)}
                className="pl-9"
              />
              <div className="absolute left-3 top-2.5 text-slate-400">
                <Path className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Update the mileage for accurate billing and reporting.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditWaitTimeDialog({
  isOpen,
  onOpenChange,
  trip,
  onConfirm,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip | null;
  onConfirm: (minutes: number) => void;
}) {
  const [minutes, setMinutes] = useState<string>("");

  useEffect(() => {
    if (trip && isOpen) {
      setMinutes((trip.total_waiting_minutes || 0).toString());
    }
  }, [trip, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(parseInt(minutes) || 0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Edit Wait Time</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Total Wait Time (Minutes)
            </label>
            <div className="relative">
              <Input
                type="number"
                step="1"
                min="0"
                required
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="pl-9"
              />
              <div className="absolute left-3 top-2.5 text-slate-400">
                <Timer className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Update the wait time for accurate billing. Wait time beyond the
              free minutes will be charged.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
