import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import * as types from "./types.ts";
import * as timezone from "../../lib/timezone.ts";
import * as mobilePayload from "./mobilePayload.ts";
import { mobileInspection } from "./testFixtures.mjs";

const requirePackage = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync(new URL("./print.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const exported = {};
new Function("require", "exports", compiled)((id) => {
  if (id === "./types") return types;
  if (id === "./mobilePayload") return mobilePayload;
  if (id === "@/lib/timezone") return timezone;
  return requirePackage(id);
}, exported);

const record = {
  id: "record-selected", driver_id: "driver-1", title: "Annual inspection",
  inspection_date: "2026-09-16", inspector_name: "QA Inspector", result: "passed",
  reference: "QA-REF-1", next_due_date: "2027-09-16", notes: "Inspected and recorded.",
  report_filename: "qa-report.pdf", updated_at: "2026-09-17T12:00:00Z",
};
const options = {
  driverNames: new Map([["driver-1", "QA Driver"]]), organizationName: "QA Company",
  title: "Selected STS inspection", timezone: "America/Chicago",
};

test("record PDF has a meaningful title and contains the supplied record and report details", () => {
  const doc = exported.createStsInspectionPDF({ ...options, records: [record] });
  const commands = doc.internal.pages.flat().join("\n");
  assert.match(doc.output(), /\/Title \(Selected STS inspection\)/);
  for (const text of ["record-selected", "QA Driver", "QA Inspector", "qa-report.pdf", "Sep 16, 2026", "Passed"]) {
    assert.ok(commands.includes(text), `Missing PDF field: ${text}`);
  }
  assert.equal(doc.getNumberOfPages(), 1);
});

test("long notes and multiple records survive PDF pagination without losing the final text", () => {
  const long = { ...record, notes: "Long inspection observation. ".repeat(320) + "FINAL-NOTE-MARKER" };
  const last = { ...record, id: "LAST-RECORD-MARKER", title: "Last record", notes: "Final record notes" };
  const doc = exported.createStsInspectionPDF({ ...options, records: [long, last] });
  assert.ok(doc.getNumberOfPages() > 1);
  const commands = doc.internal.pages.flat().join("\n");
  assert.ok(commands.includes("FINAL-NOTE-MARKER"));
  assert.ok(commands.includes("LAST-RECORD-MARKER"));
  for (let index = 1; index <= doc.getNumberOfPages(); index++) {
    assert.ok(doc.internal.pages[index].join("\n").includes(`Page ${index} of ${doc.getNumberOfPages()}`));
  }
});

test("printing empty history fails rather than generating an empty inspection record", () => {
  assert.throws(() => exported.createStsInspectionPDF({ ...options, records: [] }), /at least one inspection/);
});

test("opening a preview does not embed an automatic print action", () => {
  const doc = exported.createStsInspectionPDF({ ...options, records: [record] });
  const pdf = doc.output();
  assert.doesNotMatch(pdf, /\/N\s*\/Print\b/);
  assert.doesNotMatch(pdf, /\/S\s*\/JavaScript\b/);
});

test("mobile record PDF includes all raw checklist answers and driver vehicle details without changing review status", () => {
  const doc = exported.createStsInspectionPDF({ ...options, records: [mobileInspection] });
  assert.ok(doc.internal.pages[1].join("\n").includes("QA Driver"), "The first page must contain inspection details, not only a report heading");
  const commands = doc.internal.pages.flat().join("\n");
  // The narrow label column wraps "Wheelchair Securement" into two PDF text runs.
  for (const text of ["Driver app", "Pending review", "QA Driver Snapshot", "QA-PLATE", "012345", "Vehicle Brakes", "No Good", "Left brake is noisy.", "Inspect before next trip.", "Remarks", "Wheelchair", "Securement"]) {
    assert.ok(commands.includes(text), `Missing mobile evidence in PDF: ${text}`);
  }
});
