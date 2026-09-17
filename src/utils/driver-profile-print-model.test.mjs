import assert from "node:assert/strict";
import test from "node:test";
import { createDriverProfilePDFDocument } from "./driver-profile-pdf.ts";
import {
  buildDriverBasicPrintRows,
  buildDriverInspectionPrintRows,
  hasDriverPrintSections,
} from "./driver-profile-print-model.ts";
import { buildDriverTripPrintData, getDriverTripDateBounds } from "./driver-trip-print.ts";

const driver = {
  id: "driver-one", org_id: "org-one", full_name: "Sample Driver",
  phone: "555-0100", notes: "Distinctive full driver notes", inspection_date: "2026-09-01",
};
const inspection = {
  id: "inspection-one", org_id: "org-one", driver_id: "driver-one",
  title: "Annual vehicle inspection", inspection_date: "2026-09-15",
  inspector_name: "Sample Inspector", result: "follow_up", reference: "STS-100",
  notes: "Replace worn ramp strap", next_due_date: "2026-10-15",
  report_filename: "inspection.pdf", report_file_path: null,
  report_file_type: null, report_file_size: null,
  created_by: "admin-one", updated_by: "admin-one",
  created_at: "2026-09-16T12:00:00.000Z", updated_at: "2026-09-16T12:00:00.000Z",
};
const allSections = { basicInfo: true, tripCount: true, stsHistory: true };
const trip = {
  id: "trip-one", org_id: "org-one", driver_id: "driver-one", patient_id: "patient-one",
  pickup_time: "2026-09-15T14:30:00Z", pickup_location: "100 Pickup Avenue",
  dropoff_location: "200 Dropoff Road", status: "completed", broker_trip_id: "BROKER-123",
  broker_reference_number: "REF-456", actual_distance_miles: 12.25, distance_miles: 14,
  patient: { id: "patient-one", org_id: "org-one", full_name: "Sample Passenger" },
};
const pdfInput = {
  driver, orgName: "Sample Transportation", timezone: "America/Chicago",
  sections: allSections, trips: [trip], inspections: [inspection],
};
const pdfCommands = (doc) => Array.from(
  doc.internal.pages.flat().join("\n").matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g),
  ([, text]) => text.replace(/\\([()\\])/g, "$1"),
).join(" ");

test("all seven checkbox combinations include exactly the selected content", () => {
  for (let selection = 1; selection < 8; selection++) {
    const sections = { basicInfo: Boolean(selection & 1), tripCount: Boolean(selection & 2), stsHistory: Boolean(selection & 4) };
    assert.equal(hasDriverPrintSections(sections), true);
    const commands = pdfCommands(createDriverProfilePDFDocument({ ...pdfInput, sections }));
    assert.equal(commands.includes("Distinctive full driver notes"), sections.basicInfo);
    assert.equal(commands.includes("Total assigned trips"), sections.tripCount);
    assert.equal(commands.includes("Sample Passenger"), sections.tripCount);
    assert.equal(commands.includes("100 Pickup Avenue"), sections.tripCount);
    assert.equal(commands.includes("Annual vehicle inspection"), sections.stsHistory);
    assert.match(commands, /Sample Driver/);
    assert.match(commands, /driver-one/);
  }
});

test("no selected sections cannot produce an empty report", () => {
  const sections = { basicInfo: false, tripCount: false, stsHistory: false };
  assert.equal(hasDriverPrintSections(sections), false);
  assert.throws(() => createDriverProfilePDFDocument({ ...pdfInput, sections }), /Select at least one/);
});

test("a genuinely empty trip history prints zero while unavailable details fail", () => {
  const rows = buildDriverTripPrintData({ driver, trips: [], timezone: "America/Chicago" }).summaryRows;
  assert.equal(rows.find(([label]) => label.startsWith("Total assigned trips"))[1], "0");
  const commands = pdfCommands(createDriverProfilePDFDocument({ ...pdfInput, trips: [] }));
  assert.match(commands, /No assigned trips found/);
  assert.throws(() => createDriverProfilePDFDocument({ ...pdfInput, trips: undefined }), /unavailable/);
});

test("unselected data is neither required nor accidentally included", () => {
  const doc = createDriverProfilePDFDocument({ ...pdfInput, sections: { basicInfo: true, tripCount: false, stsHistory: false }, trips: undefined, inspections: undefined });
  assert.equal(doc.getNumberOfPages(), 1);
  assert.doesNotMatch(pdfCommands(doc), /STS inspection|Total assigned trips/);
});

test("trip details retain references, full route, local pickup time, and distinct recorded/estimated mileage", () => {
  const commands = pdfCommands(createDriverProfilePDFDocument(pdfInput));
  for (const value of ["Sep 15, 2026 9:30 AM", "trip-one", "BROKER-123", "REF-456", "Sample Passenger", "100 Pickup Avenue", "200 Dropoff Road", "completed", "Recorded: 12.25 mi", "Estimated: 14 mi"]) {
    assert.ok(commands.includes(value), value);
  }
  const rows = buildDriverTripPrintData({ driver, trips: [{ ...trip, actual_distance_miles: 0, distance_miles: null }], timezone: "UTC" }).detailRows;
  assert.match(rows[0][2], /Recorded: 0 mi/);
  assert.doesNotMatch(rows[0][2], /Estimated/);
  const missing = buildDriverTripPrintData({ driver, trips: [{ ...trip, actual_distance_miles: null, distance_miles: null, patient: null }], timezone: "UTC" }).detailRows;
  assert.match(missing[0][2], /Mileage not recorded/);
  assert.match(missing[0][1], /Passenger: Unavailable/);
});

test("trip report rejects another driver, company, passenger tenant, or duplicate trip", () => {
  for (const wrong of [
    { ...trip, driver_id: "other" }, { ...trip, org_id: "other" },
    { ...trip, patient: { ...trip.patient, org_id: "other" } },
    { ...trip, patient: { ...trip.patient, id: "other" } },
  ]) assert.throws(() => createDriverProfilePDFDocument({ ...pdfInput, trips: [wrong] }), /do not match/);
  assert.throws(() => createDriverProfilePDFDocument({ ...pdfInput, trips: [trip, trip] }), /changed while loading/);
});

test("pickup date bounds include the whole local day through daylight saving changes", () => {
  assert.deepEqual(getDriverTripDateBounds({ startDate: "2026-03-08", endDate: "2026-03-08" }, "America/Chicago"), {
    from: "2026-03-08T06:00:00.000Z", before: "2026-03-09T05:00:00.000Z",
  });
  assert.deepEqual(getDriverTripDateBounds({ startDate: "2026-11-01", endDate: "2026-11-01" }, "America/Chicago"), {
    from: "2026-11-01T05:00:00.000Z", before: "2026-11-02T06:00:00.000Z",
  });
  assert.throws(() => getDriverTripDateBounds({ startDate: "2026-02-31", endDate: "" }, "UTC"), /valid/);
  assert.throws(() => getDriverTripDateBounds({ startDate: "2026-09-16", endDate: "2026-09-15" }, "UTC"), /on or after/);
  assert.throws(() => createDriverProfilePDFDocument({ ...pdfInput, tripDateRange: { startDate: "2026-09-16", endDate: "2026-09-16" } }), /selected pickup dates/);
});

test("a long trip history prints every trip and preserves following STS records", () => {
  const trips = Array.from({ length: 90 }, (_, index) => ({ ...trip, id: `TRIP-ROW-${String(index).padStart(3, "0")}-END` }));
  const doc = createDriverProfilePDFDocument({ ...pdfInput, trips });
  assert.ok(doc.getNumberOfPages() > 5);
  const commands = pdfCommands(doc);
  for (const row of trips) assert.ok(commands.includes(row.id), row.id);
  assert.match(commands, /Replace worn ramp strap/);
});

test("driver STS section includes the full original mobile vehicle checklist", () => {
  const mobile = { ...inspection, result: "pending", source: "mobile_app", source_record_id: "mobile-one", inspection_payload: {
    id: "mobile-one", driverId: driver.id, date: "2026-09-15", dayOfWeek: "Tuesday", submittedAt: "2026-09-15T15:00:00Z",
    driverInfo: { driverName: driver.full_name, mndotNumber: "MNDOT-100", make: "Ford", model: "Transit", year: "2025", licensePlate: "STS-111", mileage: "22500" },
    items: [{ key: "brakes", label: "Brakes", status: "good" }, { key: "ramp", label: "Wheelchair ramp", status: "no_good", explanation: "Ramp latch needs replacement before service." }],
  } };
  const commands = pdfCommands(createDriverProfilePDFDocument({ ...pdfInput, inspections: [mobile] }));
  for (const text of ["Pending review", "MNDOT-100", "Transit", "STS-111", "22500", "Brakes", "Good", "Wheelchair ramp", "No Good", "Ramp latch needs replacement before service."]) assert.ok(commands.includes(text), text);
  assert.throws(() => createDriverProfilePDFDocument({ ...pdfInput, inspections: [{ ...mobile, inspection_payload: null }] }), /checklist is unavailable/);
});

test("empty inspection history stays truthful and missing history fails", () => {
  const rows = buildDriverInspectionPrintRows(driver, [], value => value || "Not recorded");
  assert.match(rows[0].rows[0][1], /No STS inspections recorded/);
  assert.throws(() => buildDriverInspectionPrintRows(driver, undefined, String), /unavailable/);
  assert.equal(rows.length, 1); // The legacy profile inspection_date is not a historical inspection.
});

test("inspection history rejects another driver or organization's records", () => {
  for (const record of [{ ...inspection, driver_id: "driver-two" }, { ...inspection, org_id: "org-two" }]) {
    assert.throws(() => buildDriverInspectionPrintRows(driver, [record], String), /does not match/);
  }
});

test("inspection results, dates, references and full findings remain accurate", () => {
  const rows = buildDriverInspectionPrintRows(driver, [inspection], String)[0].rows;
  assert.deepEqual(rows.find(([label]) => label === "Result"), ["Result", "Follow-up needed"]);
  assert.deepEqual(rows.find(([label]) => label === "Notes"), ["Notes", "Replace worn ramp strap"]);
  const commands = pdfCommands(createDriverProfilePDFDocument(pdfInput));
  assert.match(commands, /Sep 15, 2026/); // A date-only field must not shift backwards in Chicago.
  assert.match(commands, /STS-100/);
});

test("long notes paginate without truncating the final words", () => {
  const notes = `${"Driver note details that must remain in the printed record. ".repeat(140)}END OF ALL DRIVER NOTES`;
  const rows = buildDriverBasicPrintRows({ ...driver, notes }, String);
  assert.equal(rows.find(([label]) => label === "Notes")[1], notes);
  const doc = createDriverProfilePDFDocument({ ...pdfInput, driver: { ...driver, notes } });
  assert.ok(doc.getNumberOfPages() > 1);
  assert.match(pdfCommands(doc), /END OF ALL DRIVER NOTES/);
  assert.match(pdfCommands(doc), /Replace worn ramp strap/);
});
