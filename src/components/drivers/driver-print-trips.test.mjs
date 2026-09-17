import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as tripPrint from "../../utils/driver-trip-print.ts";

const source = ts.transpileModule(readFileSync(new URL("./driver-print-trips.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const trip = (id) => ({ id, org_id: "org-one", driver_id: "driver-one", patient_id: "patient-one", patient: { id: "patient-one", org_id: "org-one", full_name: "Sample Passenger" } });
const scope = { orgId: "org-one", driverId: "driver-one", timezone: "America/Chicago" };

function makeApi(pages) {
  const calls = [];
  let pageIndex = 0;
  const supabase = { from(table) {
    const call = { table, filters: [], order: [] };
    calls.push(call);
    const query = {
      select(fields, options) { call.fields = fields; call.options = options; return query; },
      eq(key, value) { call.filters.push(["eq", key, value]); return query; },
      gte(key, value) { call.filters.push(["gte", key, value]); return query; },
      lt(key, value) { call.filters.push(["lt", key, value]); return query; },
      order(key, options) { call.order.push([key, options]); return query; },
      range(start, end) { call.range = [start, end]; return query; },
      then(resolve, reject) { return Promise.resolve(pages[pageIndex++]).then(resolve, reject); },
    };
    return query;
  } };
  const exports = {};
  runInNewContext(source, { exports, require(id) {
    if (id === "@/lib/supabase") return { supabase };
    if (id === "@/utils/driver-trip-print") return tripPrint;
    throw new Error(`Unexpected import ${id}`);
  } });
  return { api: exports, calls };
}

test("trip export reads beyond 1000 rows and scopes every page to the driver, company, and full local date range", async () => {
  const rows = Array.from({ length: 1001 }, (_, index) => trip(`trip-${index}`));
  const { api, calls } = makeApi([rows.slice(0, 500), rows.slice(500, 1000), rows.slice(1000)].map(data => ({ data, count: 1001, error: null })));
  const result = await api.fetchDriverPrintTrips({ ...scope, range: { startDate: "2026-03-08", endDate: "2026-03-08" } });
  assert.equal(result.length, 1001);
  assert.equal(result.at(-1).id, "trip-1000");
  assert.deepEqual(calls.map(call => call.range), [[0, 499], [500, 999], [1000, 1499]]);
  for (const call of calls) {
    assert.deepEqual(call.filters, [["eq", "org_id", "org-one"], ["eq", "driver_id", "driver-one"], ["gte", "pickup_time", "2026-03-08T06:00:00.000Z"], ["lt", "pickup_time", "2026-03-09T05:00:00.000Z"]]);
    assert.deepEqual(call.order.map(([key]) => key), ["pickup_time", "id"]);
    assert.equal(call.options.count, "exact");
    assert.match(call.fields, /patient:patients\(id,org_id,full_name\)/);
    assert.doesNotMatch(call.fields, /signature|phone|email/);
  }
});

test("pagination honors a lower server row limit instead of truncating at the first short page", async () => {
  const { api, calls } = makeApi([
    { data: [trip("one"), trip("two")], count: 3, error: null },
    { data: [trip("three")], count: 3, error: null },
  ]);
  assert.equal((await api.fetchDriverPrintTrips(scope)).length, 3);
  assert.deepEqual(calls.map(call => call.range), [[0, 499], [2, 501]]);
});

test("a later query failure cannot return a partial trip export", async () => {
  const { api } = makeApi([{ data: [trip("one")], count: 2, error: null }, { data: null, count: null, error: new Error("Trip access expired") }]);
  await assert.rejects(api.fetchDriverPrintTrips(scope), /Trip access expired/);
});

test("missing counts, changing lists, duplicate pages, and foreign scope fail explicitly", async () => {
  const cases = [
    [{ data: [], count: null, error: null }],
    [{ data: [], count: 1, error: null }],
    [{ data: [trip("one")], count: 2, error: null }, { data: [trip("two")], count: 3, error: null }],
    [{ data: [trip("one")], count: 2, error: null }, { data: [trip("one")], count: 2, error: null }],
    [{ data: [{ ...trip("one"), org_id: "other" }], count: 1, error: null }],
    [{ data: [{ ...trip("one"), patient: { id: "patient-one", org_id: "other" } }], count: 1, error: null }],
  ];
  for (const pages of cases) await assert.rejects(makeApi(pages).api.fetchDriverPrintTrips(scope), /could not be loaded|changed while loading|do not match/);
});

test("unfiltered empty history is truthful and invalid requests fail before any query", async () => {
  const { api, calls } = makeApi([{ data: [], count: 0, error: null }]);
  assert.equal((await api.fetchDriverPrintTrips(scope)).length, 0);
  assert.equal(calls[0].filters.length, 2);
  const invalid = makeApi([]);
  await assert.rejects(invalid.api.fetchDriverPrintTrips({ ...scope, orgId: "" }), /required/);
  await assert.rejects(invalid.api.fetchDriverPrintTrips({ ...scope, range: { startDate: "2026-02-31", endDate: "" } }), /valid/);
  assert.equal(invalid.calls.length, 0);
});
