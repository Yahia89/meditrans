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
      <DialogContent className="max-w-3xl w-[95vw] max-h-[85vh] flex flex-col p-0 border-none shadow-2xl rounded-2xl bg-white overflow-hidden">
        {/* Header - Fixed at top */}
        <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-white shrink-0">
          <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
            {tripId ? "Edit Trip Details" : "Schedule New Trip"}
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            {tripId
              ? "Update the trip information below"
              : "Fill in the details to create a new trip"}
          </p>
        </DialogHeader>

        {/* Scrollable Content Area */}
        <ScrollArea className="flex-1 min-h-0 overflow-auto">
          <div className="p-6">
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

        {/* Footer - Fixed at bottom */}
        <DialogFooter className="p-6 border-t border-slate-100 bg-white flex items-center justify-end gap-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="rounded-lg h-10 px-6 font-medium gap-2"
          >
            <ChevronLeft size={16} />
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-trip-form"
            disabled={isSubmitting}
            className="bg-[#3D5A3D] hover:bg-[#2E4A2E] text-white rounded-lg h-10 px-8 font-semibold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {tripId ? "Updating..." : "Scheduling..."}
              </>
            ) : tripId ? (
              "Update Trip"
            ) : (
              "Create New Trip"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
