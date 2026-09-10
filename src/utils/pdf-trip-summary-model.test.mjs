import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFixedPdfMilestoneRows,
  formatPdfCoordinate,
  PDF_MILESTONE_DEFINITIONS,
  SAMPLE_DRIVER_ATTESTATION,
} from "./pdf-trip-summary-model.ts";
import { createTripSummaryPDFDocument } from "./pdf-generator.ts";

const EXPECTED_ATTESTATION =
  "Driver Attestation: By checking this attestation, I understand that I am electronically signing that I affirm that the information contained herein is true and accurate and that I provided and completed the above services. In a proceeding, evidence of a record or signature may not be excluded solely because it is in electronic form.";

test("uses the sample's exact fixed milestone row order", () => {
  assert.deepEqual(
    PDF_MILESTONE_DEFINITIONS.map(({ key, label }) => [key, label]),
    [
      ["en_route", "In Route"],
      ["in_pickup_circle", "In PU Circle"],
      ["loaded", "Loaded"],
      ["in_dropoff_circle", "In DO Circle"],
      ["completed", "Completed"],
    ],
  );
});

test("maps canonical and legacy status names into those five rows", () => {
  const rows = buildFixedPdfMilestoneRows([
    {
      status: "COMPLETED",
      created_at: "2026-03-18T18:52:00.000Z",
      latitude: 40.436627,
      longitude: -79.983862,
    },
    {
      status: "IN_PROGRESS",
      created_at: "2026-03-18T18:36:00.000Z",
      latitude: 40.408928,
      longitude: -79.943034,
    },
    {
      status: "IN_PICKUP_CIRCLE",
      created_at: "2026-03-18T18:31:00.000Z",
      latitude: 40.407,
      longitude: -79.91,
    },
    {
      status: "IN_DROPOFF_CIRCLE",
      created_at: "2026-03-18T18:49:00.000Z",
      latitude: 40.43,
      longitude: -79.97,
    },
    {
      status: "EN_ROUTE",
      created_at: "2026-03-18T18:04:00.000Z",
      latitude: 40.404648,
      longitude: -79.822491,
    },
  ]);

  assert.deepEqual(
    rows.map((row) => row.createdAt),
    [
      "2026-03-18T18:04:00.000Z",
      "2026-03-18T18:31:00.000Z",
      "2026-03-18T18:36:00.000Z",
      "2026-03-18T18:49:00.000Z",
      "2026-03-18T18:52:00.000Z",
    ],
  );
  assert.equal(formatPdfCoordinate(rows[2].latitude), "40.408928");
  assert.equal(formatPdfCoordinate(rows[2].longitude), "-79.943034");
});

test("keeps missing historic events and coordinates explicitly unrecorded", () => {
  const rows = buildFixedPdfMilestoneRows([
    {
      status: "EN_ROUTE",
      created_at: "2026-03-18T18:04:00.000Z",
      latitude: 0,
      longitude: 0,
    },
    {
      status: "COMPLETED",
      created_at: "2026-03-18T18:52:00.000Z",
      latitude: 91,
      longitude: -79.9,
    },
  ]);

  assert.equal(rows.length, 5);
  assert.equal(formatPdfCoordinate(rows[0].latitude), "Not recorded");
  assert.equal(formatPdfCoordinate(rows[0].longitude), "Not recorded");
  assert.equal(rows[1].createdAt, null);
  assert.equal(formatPdfCoordinate(rows[1].latitude), "Not recorded");
  assert.equal(rows[4].latitude, null);
  assert.equal(formatPdfCoordinate(rows[4].longitude), "-79.900000");
});

test("does not relabel a manual arrived event as geofence evidence", () => {
  const rows = buildFixedPdfMilestoneRows([
    {
      status: "ARRIVED_AT_PICKUP",
      created_at: "2026-03-18T18:31:00.000Z",
      latitude: 40.407,
      longitude: -79.91,
      trigger_kind: "manual",
      source_surface: "trip_detail",
      client_platform: "web",
      location_source: "browser_geolocation",
    },
  ]);

  assert.equal(rows[1].createdAt, null);
  assert.equal(rows[1].origin, "Not recorded");
});

test("selects the earliest event without dropping provenance", () => {
  const rows = buildFixedPdfMilestoneRows([
    {
      status: "EN_ROUTE",
      created_at: "2026-03-18T18:05:00.000Z",
      latitude: 40.2,
      longitude: -79.2,
      trigger_kind: "manual",
      source_surface: "trip_detail",
      client_platform: "web",
      location_source: "browser_geolocation",
    },
    {
      status: "EN_ROUTE",
      created_at: "2026-03-18T18:04:00.000Z",
      latitude: 40.1,
      longitude: -79.1,
      trigger_kind: "automatic",
      source_surface: "map_view",
      client_platform: "ios",
      location_source: "navigation_sdk",
    },
  ]);

  assert.equal(rows[0].createdAt, "2026-03-18T18:04:00.000Z");
  assert.equal(rows[0].origin, "Auto / Map / iOS / Navigation SDK");
});

test("uses the exact sample attestation and never substitutes a signature", () => {
  assert.equal(SAMPLE_DRIVER_ATTESTATION, EXPECTED_ATTESTATION);
});

test("renders a single portrait A4 page with absent evidence", () => {
  const trip = {
    id: "trip-internal-id",
    org_id: "org-id",
    patient_id: "patient-id",
    driver_id: "driver-id",
    pickup_location: "111 Pickup Street, Minneapolis, MN",
    dropoff_location: "222 Drop-off Avenue, Minneapolis, MN",
    pickup_time: "2026-03-18T18:45:00.000Z",
    trip_type: "ambulatory",
    status: "completed",
    notes: null,
    created_at: "2026-03-18T18:00:00.000Z",
    signature_data: null,
    patient: {
      id: "patient-id",
      full_name: "Sample Client",
      phone: null,
      email: null,
      created_at: "2026-03-01T00:00:00.000Z",
      user_id: null,
    },
    driver: {
      id: "driver-id",
      full_name: "Sample Driver",
      phone: null,
      email: null,
      user_id: null,
      id_number: "must-not-be-used-as-license",
      license_number: null,
      vehicle_info: null,
      vehicle_type: null,
      vehicle_make: null,
      vehicle_model: null,
      license_plate: null,
    },
  };
  const doc = createTripSummaryPDFDocument(
    trip,
    [],
    "Future Transportation",
    "America/Chicago",
  );

  assert.equal(doc.getNumberOfPages(), 1);
  assert.ok(Math.abs(doc.internal.pageSize.width - 210) < 0.2);
  assert.ok(Math.abs(doc.internal.pageSize.height - 297) < 0.2);
  assert.ok(doc.output("arraybuffer").byteLength > 1_000);
});
