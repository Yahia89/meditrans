import { SignatureCaptureDialog, SignatureDisplay } from "./SignatureCapture";
import { JourneyTimeline, useJourneyTrips } from "./JourneyTimeline";
import { Button } from "@/components/ui/button";
import { CaretLeft, DotsThreeVertical } from "@phosphor-icons/react";

// Sub-components
import { TripInfoCard } from "./details/TripInfoCard";
import { TripStatusActions } from "./details/TripStatusActions";
import { TripMetrics } from "./details/TripMetrics";
import { DriverProfileCard } from "./details/TripProfiles";
import { TripActivityTimeline } from "./details/TripActivityTimeline";
import {
  DeleteConfirmationDialog,
  StatusUpdateDialog,
  EditMileageDialog,
  EditWaitTimeDialog,
} from "./details/TripDetailsDialogs";
import { StatusHeader } from "./details/StatusHeader";
import { useTripDetails } from "./details/hooks/useTripDetails";

interface TripDetailsProps {
  tripId: string;
  onEdit?: (id: string) => void;
  onDeleteSuccess?: () => void;
  onBack?: () => void;
  onNavigate?: (id: string) => void;
}

export function TripDetails({
  tripId,
  onEdit,
  onDeleteSuccess,
  onBack,
  onNavigate,
}: TripDetailsProps) {
  const { state, actions } = useTripDetails({
    tripId,
    onDeleteSuccess,
  });

  const { data: journeyTrips } = useJourneyTrips(
    state.trip?.patient_id,
    state.trip?.pickup_time,
    state.activeTimezone,
  );

  if (state.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <DotsThreeVertical className="h-8 w-8 animate-pulse text-slate-300" />
      </div>
    );
  }

  if (!state.trip) return <div>Trip not found</div>;

  return (
    <div className="space-y-6">
      {onBack && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 -ml-2 h-9 px-3 rounded-xl transition-colors"
        >
          <CaretLeft weight="bold" className="w-4 h-4" />
          Back to Trips
        </Button>
      )}

      {(state.isDesignatedDriver || state.canManage) && (
        <StatusHeader trip={state.trip} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <TripInfoCard
            trip={state.trip}
            canManage={state.canManage}
            canDeleteTrips={state.canDeleteTrips}
            onEdit={onEdit}
            onDeleteRequest={() => actions.setIsDeleteDialogOpen(true)}
            activeTimezone={state.activeTimezone}
          />

          <TripStatusActions
            trip={state.trip}
            isDesignatedDriver={state.isDesignatedDriver}
            canManage={state.canManage}
            handleStatusUpdate={actions.handleStatusUpdate}
            setShowSignatureDialog={actions.setShowSignatureDialog}
            isGeneratingPDF={state.isGeneratingPDF}
            setIsGeneratingPDF={actions.setIsGeneratingPDF}
            journeyTrips={journeyTrips}
            history={state.history}
            orgName={state.org?.name}
            activeTimezone={state.activeTimezone}
          />
        </div>

        <div className="flex flex-col gap-6">
          <TripMetrics
            trip={state.trip}
            canManage={state.canManage}
            onEditMileage={actions.handleEditMileage}
            onEditWaitTime={actions.handleEditWaitTime}
          />

          {state.trip.patient_id && (
            <JourneyTimeline
              currentTripId={state.trip.id}
              patientId={state.trip.patient_id}
              pickupTime={state.trip.pickup_time}
              timezone={state.activeTimezone}
              canManage={state.canManage}
              onNavigate={onNavigate || (() => {})}
              onEditMileage={actions.handleEditMileage}
              onEditWaitTime={actions.handleEditWaitTime}
            />
          )}

          <DriverProfileCard
            trip={state.trip}
            canManage={state.canManage}
            onAssignDriver={() => onEdit?.(tripId)}
          />

          <TripActivityTimeline
            trip={state.trip}
            history={state.history}
            activeTimezone={state.activeTimezone}
          />

          {state.trip.status === "completed" &&
            (state.trip.signature_data || state.trip.signature_declined) && (
              <SignatureDisplay
                signatureData={state.trip.signature_data}
                signedByName={state.trip.signed_by_name}
                capturedAt={state.trip.signature_captured_at}
                declined={state.trip.signature_declined}
                declinedReason={state.trip.signature_declined_reason}
                timezone={state.activeTimezone}
              />
            )}
        </div>
      </div>

      {/* Dialogs */}
      <DeleteConfirmationDialog
        isOpen={state.isDeleteDialogOpen}
        onOpenChange={actions.setIsDeleteDialogOpen}
        trip={state.trip}
        onConfirm={actions.deleteTrip}
      />

      <StatusUpdateDialog
        key={state.statusToUpdate || "closed"}
        statusToUpdate={state.statusToUpdate}
        onClose={() => actions.setStatusToUpdate(null)}
        onConfirm={actions.confirmStatusUpdate}
      />

      <SignatureCaptureDialog
        key={state.showSignatureDialog ? "open" : "closed"}
        open={state.showSignatureDialog}
        onOpenChange={actions.setShowSignatureDialog}
        trip={state.trip}
        onSignatureCapture={({ signatureData, signedByName }) => {
          actions.captureSignature({ signatureData, signedByName });
        }}
        onSignatureDecline={(reason) => {
          actions.captureSignature({
            declined: true,
            declinedReason: reason,
          });
        }}
        isLoading={actions.isCapturingSignature}
        timezone={state.activeTimezone}
      />

      <EditMileageDialog
        key={state.editingMileageTrip?.id || "none"}
        isOpen={!!state.editingMileageTrip}
        onOpenChange={(open) => !open && actions.setEditingMileageTrip(null)}
        trip={state.editingMileageTrip}
        onConfirm={(miles) => {
          if (state.editingMileageTrip) {
            actions.updateMileage(state.editingMileageTrip.id, miles);
          }
        }}
      />

      <EditWaitTimeDialog
        key={state.editingWaitTimeTrip?.id || "none"}
        isOpen={!!state.editingWaitTimeTrip}
        onOpenChange={(open) => !open && actions.setEditingWaitTimeTrip(null)}
        trip={state.editingWaitTimeTrip}
        onConfirm={(minutes) => {
          if (state.editingWaitTimeTrip) {
            actions.updateWaitTime(state.editingWaitTimeTrip.id, minutes);
          }
        }}
      />
    </div>
  );
}
