import { useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ALL_DRIVER_TRIP_DATES, getDriverTripDateBounds, type DriverTripDateRange } from "@/utils/driver-trip-print";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEFAULT_DRIVER_PRINT_SECTIONS,
  hasDriverPrintSections,
  type DriverPrintSections,
} from "@/utils/driver-profile-print-model";

interface DriverPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driverName: string;
  canPrintSts: boolean;
  timezone: string;
  onPrint: (sections: DriverPrintSections, tripDateRange: DriverTripDateRange) => Promise<void>;
}

const options: { key: keyof DriverPrintSections; label: string; description: string }[] = [
  { key: "basicInfo", label: "Basic information", description: "Contact, vehicle, credentials and all driver notes." },
  { key: "tripCount", label: "Trips and count", description: "Total count, pickup times, passengers, routes, statuses, references and mileage." },
  { key: "stsHistory", label: "STS inspection history", description: "Recorded inspection results, findings and follow-up notes." },
];

export function DriverPrintDialog({ open, onOpenChange, driverName, canPrintSts, timezone, onPrint }: DriverPrintDialogProps) {
  const [sections, setSections] = useState<DriverPrintSections>({ ...DEFAULT_DRIVER_PRINT_SECTIONS });
  const [tripDateRange, setTripDateRange] = useState<DriverTripDateRange>({ ...ALL_DRIVER_TRIP_DATES });
  const [isPrinting, setIsPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedSections = { ...sections, stsHistory: canPrintSts && sections.stsHistory };

  const handlePrint = async () => {
    if (!hasDriverPrintSections(selectedSections) || isPrinting) return;
    setIsPrinting(true);
    setError(null);
    try {
      if (selectedSections.tripCount) getDriverTripDateBounds(tripDateRange, timezone);
      await onPrint(selectedSections, tripDateRange);
      onOpenChange(false);
    } catch (error) {
      const message = error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "The driver report could not be created. Please try again.";
      setError(message);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isPrinting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg rounded-2xl overflow-y-auto" showCloseButton={!isPrinting}>
        <DialogHeader>
          <DialogTitle>Print driver profile</DialogTitle>
          <DialogDescription>
            Choose what to include for {driverName}. The PDF always identifies the driver by name and ID.
          </DialogDescription>
        </DialogHeader>
        <fieldset disabled={isPrinting} className="space-y-3 py-4">
          <legend className="sr-only">Report sections</legend>
          {options.filter(({ key }) => key !== "stsHistory" || canPrintSts).map(({ key, label, description }) => (
            <label key={key} htmlFor={`driver-print-${key}`} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50">
              <Checkbox
                id={`driver-print-${key}`}
                checked={sections[key]}
                disabled={isPrinting}
                onCheckedChange={(checked) => setSections((current) => ({ ...current, [key]: checked === true }))}
                className="mt-0.5"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">{label}</span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-500">{description}</span>
              </span>
            </label>
          ))}
          {selectedSections.tripCount && <div className="space-y-3 rounded-xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Trip pickup dates <span className="font-normal text-slate-500">(optional)</span></p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="driver-print-from">From</Label><Input id="driver-print-from" type="date" max={tripDateRange.endDate || undefined} value={tripDateRange.startDate} onChange={(event) => setTripDateRange((current) => ({ ...current, startDate: event.target.value }))} /></div>
              <div className="space-y-1.5"><Label htmlFor="driver-print-to">To</Label><Input id="driver-print-to" type="date" min={tripDateRange.startDate || undefined} value={tripDateRange.endDate} onChange={(event) => setTripDateRange((current) => ({ ...current, endDate: event.target.value }))} /></div>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">Leave both dates blank for all trips. Dates include the full day in {timezone}; all trip statuses are included.</p>
          </div>}
        </fieldset>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!hasDriverPrintSections(selectedSections) && <p className="text-sm text-slate-500">Select at least one section to create the PDF.</p>}
        <DialogFooter>
          <Button variant="outline" disabled={isPrinting} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={isPrinting || !hasDriverPrintSections(selectedSections)} onClick={handlePrint} className="gap-2 bg-[#3D5A3D] hover:bg-[#304830] text-white">
            {isPrinting ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
            {isPrinting ? "Preparing PDF..." : "Create PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
