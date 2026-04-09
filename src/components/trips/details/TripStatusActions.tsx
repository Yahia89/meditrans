import type { Trip, TripStatus, TripStatusHistory } from "../types";
import { Button } from "@/components/ui/button";
import { HandPointing, Signature, CheckCircle, FilePdf, DownloadSimple } from "@phosphor-icons/react";
import { Loader2 } from "lucide-react";
import { generateTripSummaryPDF } from "@/utils/pdf-generator";

interface TripStatusActionsProps {
  trip: Trip;
  isDesignatedDriver: boolean;
  canManage: boolean;
  handleStatusUpdate: (status: TripStatus) => void;
  setShowSignatureDialog: (show: boolean) => void;
  isGeneratingPDF: boolean;
  setIsGeneratingPDF: (loading: boolean) => void;
  journeyTrips: Trip[] | undefined;
  history: TripStatusHistory[] | undefined;
  orgName: string | undefined;
  activeTimezone: string;
}

export function TripStatusActions({
  trip,
  isDesignatedDriver,
  canManage,
  handleStatusUpdate,
  setShowSignatureDialog,
  isGeneratingPDF,
  setIsGeneratingPDF,
  journeyTrips,
  history,
  orgName,
  activeTimezone,
}: TripStatusActionsProps) {
  if (!isDesignatedDriver && !canManage) return null;

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-8 shadow-sm">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
            <HandPointing
              weight="duotone"
              className="w-6 h-6 text-slate-600"
            />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {isDesignatedDriver
                ? "Driver Actions"
                : "Trip Management"}
            </h3>
            <p className="text-sm text-slate-600">
              Manage the current state of this trip.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          {/* Terminal Statuses (Secondary) */}
          {!["completed", "cancelled", "no_show"].includes(
            trip.status,
          ) && (
            <>
              <Button
                variant="outline"
                onClick={() => handleStatusUpdate("no_show")}
                className="flex-1 md:flex-none border-orange-200 text-orange-700 hover:bg-orange-50 font-bold h-11 px-6 rounded-xl transition-all duration-300"
              >
                No Show
              </Button>
              <Button
                variant="outline"
                onClick={() => handleStatusUpdate("cancelled")}
                className="flex-1 md:flex-none border-red-200 text-red-600 hover:bg-red-50 font-bold h-11 px-6 rounded-xl transition-all duration-300"
              >
                Cancel
              </Button>
            </>
          )}

          {/* Status Flow */}
          {(trip.status === "assigned" ||
            trip.status === "accepted") && (
            <Button
              onClick={() => handleStatusUpdate("en_route")}
              className="flex-1 md:flex-none bg-purple-600 hover:bg-purple-700 text-white font-bold h-11 px-8 rounded-xl"
            >
              Start Driving to Pickup
            </Button>
          )}

          {trip.status === "en_route" && (
            <Button
              onClick={() => handleStatusUpdate("arrived")}
              className="flex-1 md:flex-none bg-amber-500 hover:bg-amber-600 text-white font-bold h-11 px-8 rounded-xl"
            >
              Arrived at Pickup
            </Button>
          )}

          {trip.status === "arrived" && (
            <Button
              onClick={() => handleStatusUpdate("in_progress")}
              className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 px-8 rounded-xl"
            >
              Pickup Patient
            </Button>
          )}

          {trip.status === "in_progress" && (
            <Button
              onClick={() => setShowSignatureDialog(true)}
              className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-8 rounded-xl transition-all duration-300"
            >
              <Signature weight="bold" className="w-5 h-5 mr-2" />
              Arrived at Destination / Drop Off
            </Button>
          )}

          {trip.status === "completed" && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3 px-6 py-2 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-700 font-bold shadow-sm">
                <CheckCircle
                  weight="duotone"
                  className="w-6 h-6 text-emerald-500"
                />
                Trip Completed
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  setIsGeneratingPDF(true);
                  setTimeout(async () => {
                    try {
                      await generateTripSummaryPDF(
                        trip,
                        journeyTrips || [],
                        history || [],
                        orgName,
                        activeTimezone,
                      );
                    } finally {
                      setIsGeneratingPDF(false);
                    }
                  }, 100);
                }}
                disabled={isGeneratingPDF}
                className="h-11 border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 font-bold px-4 rounded-xl gap-2 transition-all shadow-sm bg-white min-w-[190px]"
              >
                {isGeneratingPDF ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
                    Generating Report...
                  </>
                ) : (
                  <>
                    <FilePdf
                      weight="duotone"
                      className="w-5 h-5 text-red-500"
                    />
                    Download Summary
                    <DownloadSimple
                      weight="bold"
                      className="w-4 h-4 ml-1 opacity-50"
                    />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
