import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { filterStsInspections, formatInspectionDate, STS_RESULTS } from "./types.ts";

// Execute the production API against explicit database/storage fakes. No network or real files.
const compiledApi = ts.transpileModule(readFileSync(new URL("./api.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function makeApi({ pages = [[]], saveError = null, removeError = null } = {}) {
  const calls = [];
  let page = 0;
  const supabase = { from(table) {
    const call = { table, filters: [], orders: [] };
    calls.push(call);
    const query = {
      select() { return query; },
      eq(key, value) { call.filters.push([key, value]); return query; },
      order(key, options) { call.orders.push([key, options]); return query; },
      range(start, end) { call.range = [start, end]; return query; },
      insert(values) { call.operation = "insert"; call.values = values; return query; },
      update(values) { call.operation = "update"; call.values = values; return query; },
      single() { calls.push({ event: "save" }); return Promise.resolve({ data: { id: "saved", ...call.values }, error: saveError }); },
      then(resolve, reject) { return Promise.resolve({ data: pages[page++] ?? [], error: null }).then(resolve, reject); },
    };
    return query;
  } };
  const files = {
    async uploadComplianceFile(input) {
      calls.push({ event: "upload", input });
      return { file_path: "new-path", original_filename: "inspection.pdf", file_type: "application/pdf", file_size: 100 };
    },
    async removeComplianceFile(path) {
      calls.push({ event: "remove", path });
      if (removeError) throw removeError;
    },
  };
  const exported = {};
  runInNewContext(compiledApi, {
    exports: exported, crypto, console: { warn() {} },
    require(id) {
      if (id === "@/lib/supabase") return { supabase };
      if (id === "@/features/compliance/files") return files;
      if (id === "./types") return { STS_RESULTS };
      throw new Error(`Unexpected import: ${id}`);
    },
  });
  return { api: exported, calls };
}

const input = {
  title: " Annual review ", inspection_date: "2026-09-16", inspector_name: " Inspector A ",
  result: "passed", reference: "  ", notes: " Notes ", next_due_date: "2027-09-16",
};
const existing = { id: "record-1", org_id: "org-1", driver_id: "driver-1", updated_at: "2026-09-16T12:00:00Z", report_file_path: "old-path" };
const scope = { orgId: "org-1", driverId: "driver-1", input };

test("history fetch includes every page beyond the default 1000-row limit and scopes every query", async () => {
  const { api, calls } = makeApi({ pages: [Array(500).fill({ id: "first" }), Array(500).fill({ id: "second" }), [{ id: "last" }]] });
  const history = await api.fetchStsInspections({ orgId: "org-1", driverId: "driver-1" });
  assert.equal(history.length, 1001);
  assert.equal(history.at(-1).id, "last");
  assert.deepEqual(calls.map((call) => call.range), [[0, 499], [500, 999], [1000, 1499]]);
  for (const call of calls) {
    assert.deepEqual(call.filters, [["org_id", "org-1"], ["driver_id", "driver-1"]]);
    assert.equal(call.orders[0][0], "inspection_date");
    assert.equal(call.orders[1][0], "id");
  }
});

test("new records trim metadata and leave audit columns to the database", async () => {
  const { api, calls } = makeApi();
  await api.saveStsInspection(scope);
  const { values } = calls[0];
  assert.equal(values.org_id, "org-1");
  assert.equal(values.driver_id, "driver-1");
  assert.equal(values.title, "Annual review");
  assert.equal(values.inspector_name, "Inspector A");
  assert.equal(values.reference, null);
  assert.equal(values.notes, "Notes");
  assert.match(values.id, /^[0-9a-f-]{36}$/);
  assert.equal("created_by" in values, false);
  assert.equal("updated_by" in values, false);
  assert.equal("report_file_path" in values, false);
});

test("metadata edits preserve attachments and use the previous timestamp to prevent lost updates", async () => {
  const { api, calls } = makeApi();
  await api.saveStsInspection({ ...scope, existing });
  assert.equal(calls[0].operation, "update");
  assert.deepEqual(calls[0].filters, [["id", "record-1"], ["org_id", "org-1"], ["driver_id", "driver-1"], ["updated_at", existing.updated_at]]);
  assert.equal("report_file_path" in calls[0].values, false);
  assert.equal(calls.some((call) => call.event === "remove"), false);
});

test("web review updates cannot overwrite the synced app source or original checklist payload", async () => {
  const { api, calls } = makeApi();
  await api.saveStsInspection({ ...scope, existing: { ...existing, inspection_date: input.inspection_date, source: "mobile_app", source_record_id: "driver-1_2026-09-16", inspection_payload: { original: true } } });
  for (const field of ["source", "source_record_id", "inspection_payload", "driver_id"]) assert.equal(field in calls[0].values, false);
});

test("the app inspection day cannot be edited or upload a replacement before validation", async () => {
  const { api, calls } = makeApi();
  await assert.rejects(api.saveStsInspection({ ...scope, existing: { ...existing, source: "mobile_app", inspection_date: "2026-09-15" }, report: {} }), /driver app cannot be changed/);
  assert.equal(calls.length, 0);
});

test("replacement uploads first and removes the old file only after metadata is saved", async () => {
  const { api, calls } = makeApi();
  const result = await api.saveStsInspection({ ...scope, existing, report: {} });
  assert.deepEqual(calls.filter((call) => call.event).map((call) => call.event), ["upload", "save", "remove"]);
  assert.equal(calls.at(-1).path, "old-path");
  assert.equal(calls[1].values.report_filename, "inspection.pdf");
  assert.equal(result.cleanupWarning, false);
});

test("failed or stale updates remove only the new upload and preserve the existing report", async () => {
  for (const saveError of [{ code: "PGRST116", message: "No matching row" }, { message: "Save failed" }]) {
    const { api, calls } = makeApi({ saveError });
    await assert.rejects(api.saveStsInspection({ ...scope, existing, report: {} }), (error) => /changed|Save failed/.test(error.message));
    assert.deepEqual(calls.filter((call) => call.event === "remove").map((call) => call.path), ["new-path"]);
  }
});

test("a successful save remains successful and signals a failed old-file cleanup", async () => {
  const { api } = makeApi({ removeError: new Error("Storage unavailable") });
  const result = await api.saveStsInspection({ ...scope, existing, report: {} });
  assert.equal(result.cleanupWarning, true);
  assert.equal(result.inspection.id, "saved");
});

test("invalid dates or scope fail before any upload or database request", async () => {
  const { api, calls } = makeApi();
  await assert.rejects(api.saveStsInspection({ ...scope, existing: { ...existing, org_id: "other" }, report: {} }), /does not belong/);
  await assert.rejects(api.saveStsInspection({ ...scope, input: { ...input, next_due_date: "2026-01-01" }, report: {} }), /on or after/);
  await assert.rejects(api.saveStsInspection({ ...scope, input: { ...input, inspector_name: "  " }, report: {} }), /required/);
  await assert.rejects(api.saveStsInspection({ ...scope, input: { ...input, inspection_date: "2026-02-31" }, report: {} }), /valid inspection/);
  await assert.rejects(api.saveStsInspection({ ...scope, input: { ...input, result: "approved" }, report: {} }), /valid inspection result/);
  await assert.rejects(api.saveStsInspection({ ...scope, input: { ...input, title: "a".repeat(201) }, report: {} }), /200 characters/);
  assert.equal(calls.length, 0);
});

test("history filters combine driver, inclusive date bounds, result, and case-insensitive reference search", () => {
  const records = [
    { id: "a", driver_id: "one", title: "Review", inspector_name: "Inspector A", reference: "REF-25", result: "passed", inspection_date: "2026-09-16" },
    { id: "b", driver_id: "one", title: "Review", inspector_name: "Inspector A", reference: "REF-25", result: "failed", inspection_date: "2026-09-16" },
    { id: "c", driver_id: "two", title: "Review", inspector_name: "Inspector B", reference: null, result: "passed", inspection_date: "2026-09-17" },
  ];
  const filters = { driverId: "one", result: "passed", startDate: "2026-09-16", endDate: "2026-09-16", search: " ref-25 " };
  assert.deepEqual(filterStsInspections(records, filters).map((row) => row.id), ["a"]);
  assert.deepEqual(filterStsInspections(records, { driverId: "", result: "all", startDate: "", endDate: "", search: "DRIVER TWO" }, new Map([["two", "Driver Two"]])).map((row) => row.id), ["c"]);
  assert.deepEqual(filterStsInspections([], filters), []);
});

test("inspection dates retain their calendar day regardless of local timezone", () => {
  const original = process.env.TZ;
  try {
    for (const timezone of ["Pacific/Honolulu", "America/Chicago", "Pacific/Kiritimati"]) {
      process.env.TZ = timezone;
      assert.equal(formatInspectionDate("2026-09-16"), "Sep 16, 2026");
    }
    assert.equal(formatInspectionDate(null), "Not set");
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});
