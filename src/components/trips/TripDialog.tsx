import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft } from "lucide-react";
import { CreateTripForm } from "./CreateTripForm";

interface TripDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId?: string;
  onSuccess: () => void;
}

export function TripDialog({
  open,
  onOpenChange,
  tripId,
  onSuccess,
}: TripDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Don't render anything when closed to ensure queries are cleaned up
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col p-0 border-none shadow-2xl rounded-3xl bg-white overflow-hidden">
        <DialogHeader className="contents space-y-0 text-left">
          <div className="p-8 pb-4 border-b border-slate-100 bg-white rounded-t-3xl shrink-0">
            <DialogTitle className="text-2xl font-bold text-slate-900 tracking-tight">
              {tripId ? "Edit Trip Details" : "Schedule New Trip"}
            </DialogTitle>
            <p className="text-sm text-slate-500 mt-1">
              {tripId
                ? "Update the trip information below"
                : "Fill in the details to create a new trip"}
            </p>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-8 pt-6">
              <CreateTripForm
                tripId={tripId}
                onSuccess={() => {
                  onSuccess();
                  onOpenChange(false);
                }}
                onCancel={() => onOpenChange(false)}
                onLoadingChange={setIsSubmitting}
              />
            </div>
          </ScrollArea>

          <DialogFooter className="p-8 border-t border-slate-100 bg-white rounded-b-3xl flex items-center justify-end gap-4 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-xl h-12 px-8 font-semibold gap-2"
            >
              <ChevronLeft size={18} />
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-trip-form"
              disabled={isSubmitting}
              className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-12 px-10 font-bold shadow-lg shadow-slate-200/50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {tripId ? "Updating..." : "Scheduling..."}
                </>
              ) : tripId ? (
                "Update Trip Record"
              ) : (
                "Create New Trip"
              )}
            </Button>
          </DialogFooter>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
