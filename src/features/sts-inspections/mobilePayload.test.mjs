import assert from "node:assert/strict";
import test from "node:test";
import { buildMobileInspectionPrintRows, readMobileInspectionPayload } from "./mobilePayload.ts";
import { inspectionResultLabel } from "./types.ts";
import { mobileInspection, mobileInspectionPayload } from "./testFixtures.mjs";

test("mobile print rows preserve vehicle metadata, original date, mileage, every answer, and full explanations", () => {
  const rows = buildMobileInspectionPrintRows(mobileInspection, "America/Chicago");
  const values = new Map(rows);
  assert.equal(values.get("Driver name at submission"), "QA Driver Snapshot");
  assert.equal(values.get("Mileage"), "012345");
  assert.equal(values.get("Original inspection date"), "Sep 16, 2026");
  assert.equal(values.get("Day"), "Wednesday");
  assert.equal(values.get("Vehicle year"), "2024");
  assert.equal(values.get("MNDOT number"), "QA-MNDOT-100");
  assert.equal(values.get("License plate"), "QA-PLATE");
  assert.match(values.get("Driver submitted"), /Sep 16, 2026.*8:30 PM.*America\/Chicago/);
  assert.equal(values.get("Vehicle Brakes"), "No Good\nLeft brake is noisy.\nInspect before next trip.");
  for (const item of mobileInspectionPayload.items.slice(1)) assert.equal(values.get(item.label), "Good");
  assert.equal(values.get("App record ID"), mobileInspectionPayload.id);
  assert.equal(inspectionResultLabel(mobileInspection), "Pending review");
  assert.equal(mobileInspection.result, "pending");
});

test("web review edits do not reinterpret the original driver snapshot", () => {
  const reviewed = { ...mobileInspection, inspector_name: "Office Reviewer", result: "follow_up" };
  const values = new Map(buildMobileInspectionPrintRows(reviewed, "Pacific/Kiritimati"));
  assert.equal(values.get("Original inspection date"), "Sep 16, 2026");
  assert.equal(values.get("Driver name at submission"), "QA Driver Snapshot");
  assert.match(values.get("Driver submitted"), /Sep 17, 2026/);
  assert.equal(inspectionResultLabel(reviewed), "Follow-up needed");
});

test("missing or mismatched original mobile evidence blocks printing rather than creating a partial report", () => {
  for (const inspection of [
    { ...mobileInspection, inspection_payload: null },
    { ...mobileInspection, driver_id: "another-driver" },
    { ...mobileInspection, source_record_id: "another-source-record" },
    { ...mobileInspection, inspection_payload: { ...mobileInspectionPayload, date: "2026-02-31" } },
    { ...mobileInspection, inspection_payload: { ...mobileInspectionPayload, items: [] } },
    { ...mobileInspection, inspection_payload: { ...mobileInspectionPayload, items: [{ key: "brakes", label: "Brakes", status: "approved" }] } },
  ]) {
    assert.equal(readMobileInspectionPayload(inspection), null);
    assert.throws(() => buildMobileInspectionPrintRows(inspection, "America/Chicago"), /original driver checklist/);
  }
});

test("legacy incomplete answers remain unknown and ordinary web records gain no invented checklist", () => {
  const incomplete = { ...mobileInspection, inspection_payload: { ...mobileInspectionPayload, items: [{ key: "brakes", label: "Brakes", status: null }] } };
  assert.equal(new Map(buildMobileInspectionPrintRows(incomplete, "America/Chicago")).get("Brakes"), "Not recorded");
  assert.deepEqual(buildMobileInspectionPrintRows({ ...mobileInspection, source: "web_crm", inspection_payload: null }, "America/Chicago"), []);
});
