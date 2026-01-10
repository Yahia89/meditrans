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
}

export function SignatureCaptureDialog({
  open,
  onOpenChange,
  trip,
  onSignatureCapture,
  onSignatureDecline,
  isLoading = false,
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
      <DialogContent className="max-w-lg rounded-2xl p-0 overflow-hidden">
        {/* Header with trip summary */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
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
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <User weight="duotone" className="w-4 h-4 text-slate-400" />
              <span className="text-slate-300">Patient:</span>
              <span className="font-semibold text-white">
                {trip.patient?.full_name || "Unknown"}
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <MapPin
                weight="duotone"
                className="w-4 h-4 text-rose-400 shrink-0 mt-0.5"
              />
              <span className="text-slate-300 line-clamp-1">
                {trip.pickup_location}
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <MapPin
                weight="duotone"
                className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5"
              />
              <span className="text-slate-300 line-clamp-1">
                {trip.dropoff_location}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400 pt-2 border-t border-white/10">
              <div className="flex items-center gap-1.5">
                <Calendar weight="duotone" className="w-3.5 h-3.5" />
                {new Date(trip.pickup_time).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-1.5">
                <Clock weight="duotone" className="w-3.5 h-3.5" />
                {new Date(trip.pickup_time).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              {trip.distance_miles && (
                <div className="flex items-center gap-1.5">
                  <Car weight="duotone" className="w-3.5 h-3.5" />
                  {trip.distance_miles} mi
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Signature Content */}
        <div className="p-6">
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
                    "border-2 border-dashed rounded-xl overflow-hidden bg-slate-50/50 transition-all",
                    hasDrawn
                      ? "border-emerald-300 bg-emerald-50/30"
                      : "border-slate-200"
                  )}
                >
                  <SignatureCanvas
                    ref={sigCanvas}
                    penColor="#1e293b"
                    canvasProps={{
                      width: 420,
                      height: 160,
                      className: "signature-canvas w-full",
                      style: {
                        touchAction: "none",
                        cursor: "crosshair",
                      },
                    }}
                    onEnd={handleEnd}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2 text-center">
                  {hasDrawn
                    ? "✓ Signature captured"
                    : "Draw your signature above"}
                </p>
              </div>

              {/* Actions */}
              <DialogFooter className="flex-col sm:flex-row gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowDeclineForm(true)}
                  className="text-slate-500 hover:text-slate-700 h-11"
                >
                  <XCircle weight="duotone" className="w-4 h-4 mr-2" />
                  Unable to Sign
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!hasDrawn || !signerName.trim() || isLoading}
                  className={cn(
                    "flex-1 h-12 rounded-xl font-bold transition-all duration-300",
                    hasDrawn && signerName.trim()
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200/50"
                      : "bg-slate-200 text-slate-400"
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
                  className="min-h-[120px] rounded-xl border-slate-200 bg-slate-50/50"
                />
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowDeclineForm(false)}
                  className="text-slate-500 h-11"
                >
                  Back
                </Button>
                <Button
                  onClick={handleDecline}
                  disabled={!declineReason.trim() || isLoading}
                  className="flex-1 h-12 rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {isLoading ? "Saving..." : "Complete Trip Without Signature"}
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
}

export function SignatureDisplay({
  signatureData,
  signedByName,
  capturedAt,
  declined,
  declinedReason,
}: SignatureDisplayProps) {
  if (!signatureData && !declined) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
        <Signature weight="duotone" className="w-4 h-4" />
        Rider Signature
      </h3>

      {declined ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-amber-700 font-bold text-sm mb-2">
            <XCircle weight="duotone" className="w-5 h-5" />
            Signature Declined
          </div>
          {declinedReason && (
            <p className="text-sm text-amber-600/90">{declinedReason}</p>
          )}
          {capturedAt && (
            <p className="text-xs text-amber-500 mt-2">
              Recorded on {new Date(capturedAt).toLocaleString()}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Signature Image */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <img
              src={signatureData!}
              alt="Rider Signature"
              className="max-h-24 mx-auto"
            />
          </div>

          {/* Signer Info */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <User weight="duotone" className="w-4 h-4 text-slate-400" />
              <span className="font-semibold">{signedByName}</span>
            </div>
            {capturedAt && (
              <span className="text-xs text-slate-400">
                {new Date(capturedAt).toLocaleString()}
              </span>
            )}
          </div>

          {/* Verification Badge */}
          <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2 text-xs font-medium border border-emerald-100">
            <CheckCircle weight="duotone" className="w-4 h-4" />
            Signature verified and stored for audit
          </div>
        </div>
      )}
    </div>
  );
}
