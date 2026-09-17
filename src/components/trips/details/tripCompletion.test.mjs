import assert from "node:assert/strict";
import test from "node:test";

import { canCompleteTrip, canCompleteTripFromOffice, prepareWebTripCompletion } from "./tripCompletion.ts";

const trip = {
  id: "trip-1",
  org_id: "org-1",
  status: "loaded",
  driver: { user_id: "driver-1" },
};
const officeInput = {
  trip,
  userId: "dispatcher-1",
  memberships: [{ org_id: "org-1", user_id: "dispatcher-1", role: "dispatch" }],
  clientEventId: "event-1",
  signatureData: "data:image/png;base64,signature",
  signedByName: "Rider Name",
};
const location = {
  latitude: 44.9778,
  longitude: -93.265,
  accuracyMeters: 12,
  capturedAt: "2026-09-16T12:00:00.000Z",
};
const unexpectedLocation = () => {
  assert.fail("An office completion must never request browser GPS");
};

test("office completion requires the acting user's manager membership in the trip's organization", async () => {
  for (const role of ["owner", "admin", "dispatch"]) {
    assert.equal(canCompleteTripFromOffice("org-1", "dispatcher-1", [
      { org_id: "org-1", user_id: "dispatcher-1", role },
    ]), true);
  }
  for (const memberships of [
    [], // Global founder or super-admin alone does not authorize the RPC exception.
    [{ org_id: "org-2", user_id: "dispatcher-1", role: "admin" }],
    [{ org_id: "org-1", user_id: "another-user", role: "admin" }],
    ...["employee", "driver", "patient"].map(role => [{ org_id: "org-1", user_id: "dispatcher-1", role }]),
  ]) {
    assert.equal(canCompleteTripFromOffice("org-1", "dispatcher-1", memberships), false);
    await assert.rejects(
      prepareWebTripCompletion({ ...officeInput, memberships }, unexpectedLocation),
      /Only the assigned driver/,
    );
  }
});

test("office completion retains the trip/event/signature with truthful web provenance and no GPS", async () => {
  for (const status of ["loaded", "in_progress", "in_dropoff_circle", "waiting"]) {
    const params = await prepareWebTripCompletion(
      { ...officeInput, trip: { ...trip, status } },
      unexpectedLocation,
    );
    assert.deepEqual(params, {
      p_org_id: "org-1",
      p_trip_id: "trip-1",
      p_expected_status: status,
      p_new_status: "completed",
      p_client_event_id: "event-1",
      p_trigger_kind: "manual",
      p_source_surface: "web_crm",
      p_client_platform: "web",
      p_latitude: null,
      p_longitude: null,
      p_location_source: null,
      p_location_captured_at: null,
      p_location_accuracy_m: null,
      p_signature_data: officeInput.signatureData,
      p_signed_by_name: "Rider Name",
      p_signature_declined: false,
      p_signature_declined_reason: null,
    });
  }
});

test("office completion without a signature preserves the entered reason and clears stale signature data", async () => {
  const params = await prepareWebTripCompletion(
    { ...officeInput, declined: true, declinedReason: "  Rider unable to sign  " },
    unexpectedLocation,
  );
  assert.equal(params.p_signature_declined, true);
  assert.equal(params.p_signature_declined_reason, "Rider unable to sign");
  assert.equal(params.p_signature_data, null);
  assert.equal(params.p_signed_by_name, null);
});

test("a manager who is also assigned uses the same office completion path", async () => {
  const params = await prepareWebTripCompletion(
    { ...officeInput, userId: "driver-1", memberships: [{ org_id: "org-1", user_id: "driver-1", role: "admin" }] },
    unexpectedLocation,
  );
  assert.equal(params.p_latitude, null);
});

test("assigned drivers still capture and send event-time GPS", async () => {
  let captures = 0;
  const params = await prepareWebTripCompletion(
    { ...officeInput, userId: "driver-1", memberships: [] },
    async () => { captures++; return location; },
  );
  assert.equal(captures, 1);
  assert.equal(params.p_latitude, location.latitude);
  assert.equal(params.p_longitude, location.longitude);
  assert.equal(params.p_location_accuracy_m, location.accuracyMeters);
  assert.equal(params.p_location_captured_at, location.capturedAt);
  assert.equal(params.p_location_source, "browser_geolocation");
});

test("driver location failure blocks completion instead of silently falling back to null GPS", async () => {
  await assert.rejects(
    prepareWebTripCompletion(
      { ...officeInput, userId: "driver-1", memberships: [] },
      async () => { throw new Error("Location permission denied"); },
    ),
    /Location permission denied/,
  );
});

test("unauthenticated users and unrelated drivers cannot complete a trip", async () => {
  for (const input of [
    { ...officeInput, userId: undefined },
    { ...officeInput, memberships: [] },
    { ...officeInput, memberships: [], trip: { ...trip, driver: undefined } },
  ]) {
    await assert.rejects(prepareWebTripCompletion(input, unexpectedLocation), /Only the assigned driver/);
  }
});

test("early and terminal statuses cannot be completed, including from the office", async () => {
  for (const status of ["pending", "assigned", "accepted", "en_route", "arrived", "in_pickup_circle", "completed", "cancelled", "no_show"]) {
    assert.equal(canCompleteTrip(status), false);
    await assert.rejects(
      prepareWebTripCompletion({ ...officeInput, trip: { ...trip, status } }, unexpectedLocation),
      /not ready to complete/,
    );
  }
});

test("completion requires a real signature/name or a nonempty reason", async () => {
  for (const fields of [
    { signatureData: "" },
    { signedByName: "  " },
    { declined: true },
    { declined: true, declinedReason: "  " },
  ]) {
    await assert.rejects(
      prepareWebTripCompletion({ ...officeInput, ...fields }, unexpectedLocation),
      /Provide a rider signature/,
    );
  }
});
