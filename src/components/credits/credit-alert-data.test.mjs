import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { buildCreditAlerts, creditAlertQueryOptions, getCreditMonth, normalizeCreditFees, readCreditPages } from "./credit-alert-data.ts";
import { DEFAULT_FEES } from "../../lib/credit-utils.ts";

const scope = { userId: "user-a", orgId: "org-a", timezone: "America/Chicago", ...getCreditMonth(new Date("2026-10-13T18:00:00Z"), "America/Chicago") };
const patient = (id, monthly_credit = 100) => ({ id, full_name: `Synthetic ${id}`, monthly_credit });
const trip = (id, patient_id) => ({ id, patient_id, status: "completed", trip_type: "one_way", actual_distance_miles: null, distance_miles: 0, total_waiting_minutes: 0 });

function fixtureClient({ patients = [patient("patient-a")], trips = [trip("trip-a", "patient-a")], fail = null, gate = Promise.resolve() } = {}) {
  const requests = [];
  const client = createClient("https://synthetic.example.invalid", "synthetic-public-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const url = new URL(input);
      const table = url.pathname.split("/").at(-1);
      requests.push({ table, search: url.searchParams, headers: new Headers(init?.headers) });
      await gate;
      if (table === fail) return new Response(JSON.stringify({ message: "Synthetic query failure", code: "42501" }), { status: 403, headers: { "Content-Type": "application/json" } });
      const rows = table === "patients" ? patients : trips;
      return new Response(JSON.stringify(rows), { status: 200, headers: { "Content-Type": "application/json", "Content-Range": rows.length ? `0-${rows.length - 1}/${rows.length}` : "*/0" } });
    } },
  });
  return { client, requests };
}

test("two dashboard consumers share one patient read and one completed-trip read", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const { client, requests } = fixtureClient({ gate });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const first = queryClient.fetchQuery(creditAlertQueryOptions(client, scope));
  const second = queryClient.fetchQuery(creditAlertQueryOptions(client, { ...scope }));
  await new Promise((resolve) => setImmediate(resolve));
  // Both independent reads start before either is allowed to finish.
  assert.deepEqual(requests.map((request) => request.table).sort(), ["patients", "trips"]);
  release();
  assert.deepEqual(await first, await second);
  await queryClient.fetchQuery(creditAlertQueryOptions(client, scope));
  assert.equal(requests.length, 2, "warm visits reuse the same 30-second query");
  const tripRequest = requests.find((request) => request.table === "trips");
  assert.equal(tripRequest.search.get("org_id"), "eq.org-a");
  assert.equal(tripRequest.search.get("status"), "eq.completed");
  assert.deepEqual(tripRequest.search.getAll("pickup_time"), [`gte.${scope.start}`, `lt.${scope.end}`]);
  assert.equal(tripRequest.headers.get("prefer"), "count=exact");
  queryClient.clear();
});

test("cache keys isolate tenant, user, timezone, and month while retaining credit invalidation prefix", () => {
  const { client } = fixtureClient();
  const original = creditAlertQueryOptions(client, scope).queryKey;
  assert.deepEqual(original.slice(0, 2), ["low-balance-patients", "org-a"]);
  for (const patch of [{ userId: "user-b" }, { orgId: "org-b" }, { timezone: "UTC" }, { month: "2026-11" }]) {
    assert.notDeepEqual(creditAlertQueryOptions(client, { ...scope, ...patch }).queryKey, original);
  }
  assert.equal(creditAlertQueryOptions(client, null).enabled, false);
});

test("pagination preserves all rows above the API cap, including a server cap below our page size", async () => {
  const rows = Array.from({ length: 1507 }, (_, id) => ({ id }));
  const requests = [];
  const result = await readCreditPages(async (from, to, count) => {
    requests.push({ from, to, count });
    return { data: rows.slice(from, Math.min(to + 1, from + 300)), error: null, count: count ? rows.length : null };
  });
  assert.deepEqual(result, rows);
  assert.equal(requests.length, 6);
  assert.equal(requests.filter((request) => request.count).length, 1);
});

test("query and incomplete-pagination failures remain errors instead of healthy empty balances", async () => {
  const { client } = fixtureClient({ fail: "trips" });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await assert.rejects(queryClient.fetchQuery(creditAlertQueryOptions(client, scope)), { message: "Synthetic query failure" });
  assert.equal(queryClient.getQueryState(creditAlertQueryOptions(client, scope).queryKey).status, "error");
  await assert.rejects(readCreditPages(async () => ({ data: [], error: null, count: 5 })), /changed while loading/);
  queryClient.clear();
});

test("credit months use local midnight, include the final fractional second, and honor DST", () => {
  const october = getCreditMonth(new Date("2026-11-01T04:59:59.999Z"), "America/Chicago");
  assert.equal(october.month, "2026-10");
  assert.equal(october.end, "2026-11-01T05:00:00.000Z");
  const november = getCreditMonth(new Date("2026-11-01T05:00:00Z"), "America/Chicago");
  assert.equal(november.month, "2026-11");
  assert.equal(november.end, "2026-12-01T06:00:00.000Z");
  const march = getCreditMonth(new Date("2026-03-15T12:00:00Z"), "America/Chicago");
  assert.equal((Date.parse(march.end) - Date.parse(march.start)) / 3_600_000, 31 * 24 - 1);
});

test("shared alert selector preserves thresholds, patient isolation, sorting, and fee changes", () => {
  const patients = [patient("empty", null), patient("healthy"), patient("warning"), patient("critical"), patient("expired")];
  const trips = [
    ...Array.from({ length: 2 }, (_, id) => trip(`w${id}`, "warning")),
    ...Array.from({ length: 3 }, (_, id) => trip(`c${id}`, "critical")),
    ...Array.from({ length: 4 }, (_, id) => trip(`e${id}`, "expired")),
    trip("orphan", "another-patient"),
  ];
  const alerts = buildCreditAlerts(patients, trips, null);
  assert.deepEqual(alerts.map(({ id, severity }) => [id, severity]), [["expired", "expired"], ["critical", "critical"], ["warning", "warning"]]);
  assert.equal(alerts[0].remainingBalance, -4);
  assert.equal(alerts[0].percentRemaining, 0);
  assert.equal(alerts[2].percentRemaining, 0.48);
  assert.deepEqual(buildCreditAlerts(patients, trips, { ...DEFAULT_FEES, base_fee: 10 }), []);
  assert.deepEqual(buildCreditAlerts([], trips, null), []);
});

test("null fees preserve defaults and malformed custom charge payloads cannot poison alerts", () => {
  assert.equal(normalizeCreditFees(null), null);
  const fees = normalizeCreditFees({ ...DEFAULT_FEES, custom_charges: [{ name: "Valid", amount: 2, is_per_mile: false }, { name: "Invalid", amount: "bad", is_per_mile: true }, null] });
  assert.deepEqual(fees.custom_charges, [{ name: "Valid", amount: 2, is_per_mile: false }]);
});
