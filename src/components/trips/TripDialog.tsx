import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreateTripForm } from "./CreateTripForm";

interface TripDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tripId?: string;
    onSuccess: () => void;
}

export function TripDialog({ open, onOpenChange, tripId, onSuccess }: TripDialogProps) {
    // Don't render anything when closed to ensure queries are cleaned up
    if (!open) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl rounded-3xl bg-white">
                <DialogHeader className="p-8 pb-4 border-b border-slate-100 sticky top-0 bg-white z-10 rounded-t-3xl">
                    <DialogTitle className="text-2xl font-bold text-slate-900 tracking-tight">
                        {tripId ? "Edit Trip Details" : "Schedule New Trip"}
                    </DialogTitle>
                    <p className="text-sm text-slate-500 mt-1">
                        {tripId ? "Update the trip information below" : "Fill in the details to create a new trip"}
                    </p>
                </DialogHeader>
                <div className="p-8 pt-6">
                    <CreateTripForm
                        tripId={tripId}
                        onSuccess={() => {
                            onSuccess();
                            onOpenChange(false);
                        }}
                        onCancel={() => onOpenChange(false)}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
