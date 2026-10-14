import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as query from "@tanstack/react-query";

const source = ts.transpileModule(readFileSync(new URL("./directory-trip-counts.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function createApi(responses) {
  const calls = [];
  const exports = {};
  const supabase = {
    rpc(name, args, options) {
      const call = { name, args, options };
      calls.push(call);
      const builder = {
        order(column, options) { call.order = [column, options]; return builder; },
        range(start, end) { call.range = [start, end]; return builder; },
        abortSignal(signal) {
          call.signal = signal;
          return Promise.resolve(responses[Math.min(calls.length - 1, responses.length - 1)]);
        },
      };
      return builder;
    },
  };
  runInNewContext(source, { exports, require(id) {
    if (id === "@tanstack/react-query") return query;
    if (id === "@/lib/supabase") return { supabase };
    throw new Error(`Unexpected import ${id}`);
  } });
  return { options: exports.directoryTripCountsOptions, calls };
}

test("counts are scoped by organization and directory and forward cancellation", async () => {
  const api = createApi([{ data: [{ entity_id: "patient-a", total_trips: 12 }], count: 1, error: null }]);
  const signal = new AbortController().signal;
  const options = api.options("org-one", "patients");
  const result = await options.queryFn({ signal });
  assert.equal(result["patient-a"], 12);
  assert.equal(result["patient-without-trips"] ?? 0, 0);
  assert.equal(api.calls[0].name, "directory_trip_counts");
  assert.equal(api.calls[0].args.p_org_id, "org-one");
  assert.equal(api.calls[0].args.p_directory, "patients");
  assert.equal(api.calls[0].signal, signal);
  assert.equal(api.calls[0].options.count, "exact");
  assert.equal(api.calls[0].order[0], "entity_id");
  assert.equal(api.calls[0].order[1].ascending, true);
  assert.deepEqual(api.calls[0].range, [0, 499]);
});

test("empty visible counts succeed, while authorization and malformed responses cannot become zeros", async () => {
  const empty = createApi([{ data: [], count: 0, error: null }]);
  assert.equal(Object.keys(await empty.options("org-one", "drivers").queryFn({})).length, 0);
  for (const response of [
    { data: null, error: new Error("Forbidden") },
    { data: null, error: null },
    { data: [{ entity_id: "patient-a", total_trips: -1 }], count: 1, error: null },
    { data: [{ entity_id: "patient-a", total_trips: "invalid" }], count: 1, error: null },
    { data: [{ entity_id: null, total_trips: 2 }], count: 1, error: null },
  ]) {
    await assert.rejects(createApi([response]).options("org-one", "patients").queryFn({}), /Forbidden|could not be loaded/);
  }
  const missingOrg = createApi([]);
  assert.equal(missingOrg.options(undefined, "patients").enabled, false);
  await assert.rejects(missingOrg.options(undefined, "patients").queryFn({}), /organization is required/);
  assert.equal(missingOrg.calls.length, 0);
});

test("revisits reuse counts, trip invalidation refreshes them, and organization/directory caches stay separate", async () => {
  const api = createApi([
    { data: [{ entity_id: "entity-a", total_trips: 12 }], count: 1, error: null },
    { data: [{ entity_id: "entity-a", total_trips: 13 }], count: 1, error: null },
    { data: [], count: 0, error: null },
  ]);
  const client = new query.QueryClient();
  try {
    const options = api.options("org-one", "patients");
    assert.equal((await client.fetchQuery(options))["entity-a"], 12);
    assert.equal((await client.fetchQuery(options))["entity-a"], 12);
    assert.equal(api.calls.length, 1);
    await client.invalidateQueries({ queryKey: ["trips"] });
    assert.equal((await client.fetchQuery(options))["entity-a"], 13);
    assert.equal(api.calls.length, 2);
    await client.fetchQuery(api.options("org-two", "patients"));
    await client.fetchQuery(api.options("org-one", "drivers"));
    assert.equal(api.calls.length, 4);
    assert.equal((await client.fetchQuery(options))["entity-a"], 13);
    assert.equal(api.calls.length, 4);
  } finally {
    client.clear();
  }
});


test("pagination reads beyond 1000 groups and advances by actual server-capped page lengths", async () => {
  const rows = Array.from({ length: 1001 }, (_, index) => ({ entity_id: `entity-${String(index).padStart(4, "0")}`, total_trips: index + 1 }));
  const api = createApi([
    { data: rows.slice(0, 400), count: 1001, error: null },
    { data: rows.slice(400, 800), count: 1001, error: null },
    { data: rows.slice(800), count: 1001, error: null },
  ]);
  const result = await api.options("org-one", "patients").queryFn({});
  assert.equal(Object.keys(result).length, 1001);
  assert.equal(result["entity-1000"], 1001);
  assert.deepEqual(api.calls.map(call => call.range), [[0, 499], [400, 899], [800, 1299]]);
  assert.ok(api.calls.every(call => call.options.count === "exact" && call.order[0] === "entity_id"));
});

test("missing totals, truncated pages, changing group counts, duplicate groups and later errors never publish partial counts", async () => {
  const first = { data: [{ entity_id: "entity-a", total_trips: 2 }], count: 2, error: null };
  for (const pages of [
    [{ data: [], count: null, error: null }],
    [first, { data: [], count: 2, error: null }],
    [first, { data: [{ entity_id: "entity-b", total_trips: 3 }], count: 3, error: null }],
    [first, first],
    [first, { data: null, count: null, error: new Error("Request failed") }],
    [{ data: [{ entity_id: "entity-b", total_trips: 2 }, { entity_id: "entity-a", total_trips: 1 }], count: 2, error: null }],
  ]) {
    await assert.rejects(createApi(pages).options("org-one", "drivers").queryFn({}), /could not be loaded|changed while loading|Request failed/);
  }
});

test("a failed paginated refresh retains the last complete cache instead of replacing it with partial counts", async () => {
  const api = createApi([
    { data: [{ entity_id: "entity-a", total_trips: 12 }, { entity_id: "entity-b", total_trips: 5 }], count: 2, error: null },
    { data: [{ entity_id: "entity-a", total_trips: 13 }], count: 2, error: null },
    { data: null, count: null, error: new Error("Page unavailable") },
  ]);
  const client = new query.QueryClient();
  try {
    const options = { ...api.options("org-one", "patients"), retry: false };
    await client.fetchQuery(options);
    await client.invalidateQueries({ queryKey: ["trips"] });
    await assert.rejects(client.fetchQuery(options), /Page unavailable/);
    const cached = client.getQueryData(options.queryKey);
    assert.equal(cached["entity-a"], 12);
    assert.equal(cached["entity-b"], 5);
    assert.equal(api.calls.length, 3);
  } finally {
    client.clear();
  }
});
