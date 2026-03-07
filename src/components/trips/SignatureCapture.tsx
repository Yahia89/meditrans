import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Signature,
  Eraser,
  CheckCircle,
  XCircle,
  User,
  MapPin,
  Calendar,
  Clock,
  Car,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { Trip } from "./types";
import { formatInUserTimezone } from "@/lib/timezone";

interface SignatureCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip;
  onSignatureCapture: (data: {
    signatureData: string;
    signedByName: string;
  }) => void;
  onSignatureDecline: (reason: string) => void;
  isLoading?: boolean;
  timezone?: string;
}
export function SignatureCaptureDialog({
  open,
  onOpenChange,
  trip,
  onSignatureCapture,
  onSignatureDecline,
  isLoading = false,
  timezone = "UTC",
}: SignatureCaptureDialogProps) {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [signerName, setSignerName] = useState("");
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [hasDrawn, setHasDrawn] = useState(false);

  const clearSignature = () => {
    sigCanvas.current?.clear();
    setHasDrawn(false);
  };

  const handleSubmit = () => {
    if (!sigCanvas.current || !hasDrawn || !signerName.trim()) return;

    // Use getCanvas() instead of getTrimmedCanvas() to avoid alpha version bug
    // The getTrimmedCanvas() method in react-signature-canvas@1.1.0-alpha.2
    // has a broken import for trim-canvas causing runtime errors
    const canvas = sigCanvas.current.getCanvas();
    const signatureData = canvas.toDataURL("image/png");

    onSignatureCapture({
      signatureData,
      signedByName: signerName.trim(),
    });
  };

  const handleDecline = () => {
    if (!declineReason.trim()) return;
    onSignatureDecline(declineReason.trim());
  };

  const handleEnd = () => {
    // Check if there's actually been drawing (not just a dot)
    if (sigCanvas.current) {
      const canvas = sigCanvas.current.getCanvas();
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        let nonEmptyPixels = 0;
        for (let i = 3; i < pixels.length; i += 4) {
          if (pixels[i] > 0) nonEmptyPixels++;
        }
        // Require at least some strokes
        if (nonEmptyPixels > 100) {
          setHasDrawn(true);
        }
      }
    }
  };

  const resetDialog = () => {
    setSignerName("");
    setShowDeclineForm(false);
    setDeclineReason("");
    setHasDrawn(false);
    clearSignature();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) resetDialog();
        onOpenChange(val);
      }}
    >
      <DialogContent className="sm:max-w-2xl rounded-2xl p-0 overflow-hidden border-none shadow-2xl flex flex-col max-h-[96dvh] sm:max-h-[90vh]">
        {/* Header with trip summary - Fixed at top */}
        <div className="shrink-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 shadow-md z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
              <Signature weight="duotone" className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white">
                Trip Completion Signature
              </DialogTitle>
              <DialogDescription className="text-slate-300 text-sm">
                Rider confirmation required for transparency
              </DialogDescription>
            </div>
          </div>

          {/* Trip Summary */}
          <div className="bg-white/5 rounded-xl p-5 border border-white/10 mt-6 backdrop-blur-sm">
            <div className="flex flex-col sm:grid sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                    <User weight="duotone" className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">
                      Patient
                    </span>
                    <span className="font-semibold text-white">
                      {trip.patient?.full_name || "Unknown"}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm border-l-2 border-rose-500/20 pl-4">
                  <MapPin
                    weight="duotone"
                    className="w-4 h-4 text-rose-400 shrink-0 mt-0.5"
                  />
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">
                      Pickup
                    </span>
                    <span className="text-slate-300 line-clamp-2">
                      {trip.pickup_location}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                    <Clock
                      weight="duotone"
                      className="w-4 h-4 text-slate-400"
                    />
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">
                      Scheduled
                    </span>
                    <span className="font-semibold text-white">
                      {formatInUserTimezone(
                        trip.pickup_time,
                        timezone,
                        "h:mm a",
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm border-l-2 border-emerald-500/20 pl-4">
                  <MapPin
                    weight="duotone"
                    className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5"
                  />
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">
                      Dropoff
                    </span>
                    <span className="text-slate-300 line-clamp-2">
                      {trip.dropoff_location}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 text-[11px] text-slate-400 pt-5 border-t border-white/10 mt-5">
              <div className="flex items-center gap-2">
                <Calendar weight="duotone" className="w-4 h-4 text-slate-500" />
                {formatInUserTimezone(
                  trip.pickup_time,
                  timezone,
                  "MMMM d, yyyy",
                )}
              </div>
              {trip.distance_miles && (
                <div className="flex items-center gap-2">
                  <Car weight="duotone" className="w-4 h-4 text-slate-500" />
                  {trip.distance_miles} miles trip
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Signature Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-white">
          {!showDeclineForm ? (
            <>
              {/* Signer Name */}
              <div className="mb-4">
                <Label
                  htmlFor="signer-name"
                  className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block"
                >
                  Full Name of Signer
                </Label>
                <Input
                  id="signer-name"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Enter full name..."
                  className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-colors"
                />
              </div>

              {/* Signature Pad */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Signature
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearSignature}
                    className="h-7 px-2 text-xs text-slate-500 hover:text-slate-700"
                  >
                    <Eraser weight="duotone" className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                </div>
                <div
                  className={cn(
                    "border-2 border-dashed rounded-2xl overflow-hidden bg-slate-50/50 transition-all",
                    hasDrawn
                      ? "border-emerald-300 bg-emerald-50/20"
                      : "border-slate-200",
                  )}
                >
                  <SignatureCanvas
                    ref={sigCanvas}
                    penColor="#0f172a"
                    canvasProps={{
                      className: "signature-canvas w-full h-64 sm:h-80",
                      style: {
                        touchAction: "none",
                        cursor: "crosshair",
                        display: "block",
                        backgroundColor: "transparent",
                      },
                    }}
                    onEnd={handleEnd}
                  />
                </div>
                <p className="text-[11px] font-medium text-slate-400 mt-3 text-center uppercase tracking-wider">
                  {hasDrawn
                    ? "✓ Signature captured successfully"
                    : "Use your mouse or touch screen to sign above"}
                </p>
              </div>

              {/* Actions */}
              <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowDeclineForm(true)}
                  className="text-slate-500 hover:text-slate-700 h-11 w-full sm:w-auto"
                >
                  <XCircle weight="duotone" className="w-4 h-4 mr-2" />
                  Unable to Sign
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!hasDrawn || !signerName.trim() || isLoading}
                  className={cn(
                    "h-12 rounded-xl font-bold transition-all duration-300 w-full sm:flex-1",
                    hasDrawn && signerName.trim()
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
                      : "bg-slate-200 text-slate-400",
                  )}
                >
                  <CheckCircle weight="bold" className="w-5 h-5 mr-2" />
                  {isLoading ? "Saving..." : "Confirm & Complete Trip"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            /* Decline Form */
            <>
              <div className="mb-6">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">
                  Reason for Not Signing
                </Label>
                <Textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="Please explain why the signature cannot be obtained..."
                  className="min-h-[220px] rounded-2xl border-slate-200 bg-slate-50/50 p-4 focus:bg-white transition-all text-base"
                />
              </div>

              <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowDeclineForm(false)}
                  className="text-slate-500 h-11 w-full sm:w-auto"
                >
                  Back
                </Button>
                <Button
                  onClick={handleDecline}
                  disabled={!declineReason.trim() || isLoading}
                  className="h-12 rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white w-full sm:flex-1"
                >
                  {isLoading ? "Saving..." : "Complete Without Signature"}
                </Button>
              </DialogFooter>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Component to display captured signature in trip details
interface SignatureDisplayProps {
  signatureData?: string | null;
  signedByName?: string | null;
  capturedAt?: string | null;
  declined?: boolean;
  declinedReason?: string | null;
  timezone?: string;
}

export function SignatureDisplay({
  signatureData,
  signedByName,
  capturedAt,
  declined,
  declinedReason,
  timezone = "UTC",
}: SignatureDisplayProps) {
  if (!signatureData && !declined) return null;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="bg-slate-50/80 px-6 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
          <Signature weight="duotone" className="w-4 h-4 text-slate-400" />
          Rider Signature
        </h3>
        <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border border-emerald-100">
          <CheckCircle weight="bold" className="w-3 h-3" />
          Verified
        </div>
      </div>

      <div className="p-6">
        {declined ? (
          <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-amber-700 font-bold text-sm mb-3">
              <XCircle weight="duotone" className="w-5 h-5" />
              Signature Declined
            </div>
            {declinedReason && (
              <p className="text-sm text-amber-800/80 leading-relaxed bg-white/50 rounded-xl p-3 border border-amber-200/50 underline decoration-amber-200 decoration-wavy underline-offset-4">
                {declinedReason}
              </p>
            )}
            {capturedAt && (
              <div className="flex items-center gap-2 text-[10px] text-amber-500 mt-4 font-medium uppercase tracking-wider">
                <Clock weight="bold" className="w-3.5 h-3.5" />
                Recorded on{" "}
                {formatInUserTimezone(
                  capturedAt,
                  timezone,
                  "MMM d, yyyy h:mm a",
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Signature Image */}
            <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100 flex items-center justify-center min-h-[140px] group transition-colors hover:bg-white">
              <img
                src={signatureData!}
                alt="Rider Signature"
                className="max-h-32 object-contain filter drop-shadow-sm group-hover:scale-105 transition-transform duration-500"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-50">
              {/* Signer Info */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                  <User weight="duotone" className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Signed By
                  </span>
                  <span className="text-sm font-semibold text-slate-700">
                    {signedByName}
                  </span>
                </div>
              </div>

              {/* Timestamp */}
              {capturedAt && (
                <div className="sm:text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Date & Time
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatInUserTimezone(
                      capturedAt,
                      timezone,
                      "MMM d, yyyy h:mm a",
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
