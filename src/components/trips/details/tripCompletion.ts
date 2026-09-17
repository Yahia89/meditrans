import type { Trip, TripStatus } from "../types";
import type { BrowserEventLocation } from "./browserEventLocation";
import type { OrganizationMembership } from "@/contexts/auth-context";

const COMPLETABLE_STATUSES: readonly TripStatus[] = [
  "loaded",
  "in_progress",
  "in_dropoff_circle",
  "waiting",
];

export function canCompleteTrip(status: TripStatus) {
  return COMPLETABLE_STATUSES.includes(status);
}

type CompletionMembership = Pick<OrganizationMembership, "org_id" | "user_id" | "role">;

export function canCompleteTripFromOffice(
  orgId: string | undefined,
  userId: string | undefined,
  memberships: readonly CompletionMembership[],
) {
  return Boolean(orgId && userId && memberships.some(
    (membership) => membership.org_id === orgId
      && membership.user_id === userId
      && ["owner", "admin", "dispatch"].includes(membership.role),
  ));
}

type CompletionInput = {
  trip: Pick<Trip, "id" | "org_id" | "status" | "driver">;
  userId?: string;
  memberships: readonly CompletionMembership[];
  clientEventId: string;
  signatureData?: string;
  signedByName?: string;
  declined?: boolean;
  declinedReason?: string;
};

export async function prepareWebTripCompletion(
  input: CompletionInput,
  captureLocation: () => Promise<BrowserEventLocation>,
) {
  const { trip, userId, memberships, clientEventId } = input;
  const isOfficeCompletion = canCompleteTripFromOffice(trip.org_id, userId, memberships);
  if (!userId || (!isOfficeCompletion && trip.driver?.user_id !== userId)) {
    throw new Error("Only the assigned driver or an organization manager can complete this trip.");
  }
  if (!canCompleteTrip(trip.status)) {
    throw new Error("This trip is not ready to complete. Refresh its status and try again.");
  }

  const signatureData = input.signatureData?.trim() || null;
  const signedByName = input.signedByName?.trim() || null;
  const declinedReason = input.declinedReason?.trim() || null;
  if (input.declined ? !declinedReason : !signatureData || !signedByName) {
    throw new Error("Provide a rider signature and signer name, or a reason the signature could not be obtained.");
  }

  // A dispatcher's browser location is not the driver's drop-off location.
  // The RPC independently checks organization membership for this exception.
  const location = isOfficeCompletion ? null : await captureLocation();

  return {
    p_org_id: trip.org_id,
    p_trip_id: trip.id,
    p_expected_status: trip.status,
    p_new_status: "completed",
    p_client_event_id: clientEventId,
    p_trigger_kind: "manual",
    p_source_surface: "web_crm",
    p_client_platform: "web",
    p_latitude: location?.latitude ?? null,
    p_longitude: location?.longitude ?? null,
    p_location_source: location ? "browser_geolocation" : null,
    p_location_captured_at: location?.capturedAt ?? null,
    p_location_accuracy_m: location?.accuracyMeters ?? null,
    p_signature_data: input.declined ? null : signatureData,
    p_signed_by_name: input.declined ? null : signedByName,
    p_signature_declined: Boolean(input.declined),
    p_signature_declined_reason: input.declined ? declinedReason : null,
  };
}
