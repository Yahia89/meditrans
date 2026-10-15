import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { QueryClient } from "@tanstack/react-query";

const exports = {};
const context = { exports };
runInNewContext(ts.transpileModule(readFileSync(new URL("./directory-state.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, context);
const { parseDirectoryPageSize, directoryPagination, directoryPresence, isDirectoryAuthorizationError, parseDirectoryPresenceFilter, shouldRetryDirectoryRead } = exports;

test("saved Patients view works with missing, invalid and blocked browser storage", () => {
  assert.equal(exports.readSavedPatientsView(), "bento");
  for (const saved of ["list", "bento", "invalid", null]) {
    context.window = { localStorage: { getItem: () => saved } };
    assert.equal(exports.readSavedPatientsView(), saved === "list" ? "list" : "bento");
  }
  context.window = { localStorage: { getItem() { throw new Error("Blocked"); }, setItem() { throw new Error("Blocked"); } } };
  assert.equal(exports.readSavedPatientsView(), "bento");
  assert.doesNotThrow(() => exports.savePatientsView("list"));
  delete context.window;
});

test("URL limits accept only supported whole values; malformed and unbounded limits use five", () => {
  for (const input of ["5", "10", "25", "50", "all"]) assert.equal(parseDirectoryPageSize(input), input);
  for (const input of ["", "0", "-5", "9999", "10000000000000000000", "Infinity", "NaN", "5junk", "5.5", " 10", "010", "ALL", "1e3"]) {
    assert.equal(parseDirectoryPageSize(input), "5", input);
  }
});

test("pagination clamps after final-page deletion and never shows page one of zero", () => {
  const lastPage = directoryPagination("5", 3, 13);
  assert.equal(lastPage.currentPage, 3);
  assert.equal(lastPage.startIndex, 10);
  assert.equal(lastPage.endIndex, 13);
  const afterDeletion = directoryPagination("5", 3, 10);
  assert.equal(afterDeletion.currentPage, 2);
  assert.equal(afterDeletion.startIndex, 5);
  assert.equal(afterDeletion.endIndex, 10);
  const noResults = directoryPagination("5", 3, 0);
  assert.equal(noResults.currentPage, 1);
  assert.equal(noResults.totalPages, 1);
  assert.equal(noResults.startIndex, 0);
  assert.equal(noResults.endIndex, 0);
  for (const page of [0, -3, NaN, Infinity, 1.5]) assert.equal(directoryPagination("5", page, 13).currentPage, 1);
});

test("All includes every available row above the former magic 9999 cap", () => {
  const result = directoryPagination("all", 99, 12_345);
  assert.equal(result.currentPage, 1);
  assert.equal(result.totalPages, 1);
  assert.equal(result.startIndex, 0);
  assert.equal(result.endIndex, 12_345);
});

test("presence loading, missing linkage and unknown are never counted as offline", () => {
  assert.equal(directoryPresence("account", undefined, true), "loading");
  assert.equal(directoryPresence("account", undefined, false), "unknown");
  assert.equal(directoryPresence(null, undefined, true), "unlinked");
  assert.equal(directoryPresence(undefined, undefined, false), "unlinked");
  assert.equal(directoryPresence("account", "offline", false), "offline");
  assert.equal(directoryPresence("account", "online", false), "online");
  assert.equal(directoryPresence("account", "away", false), "away");
  for (const input of ["all", "online", "away", "offline"]) assert.equal(parseDirectoryPresenceFilter(input), input);
  assert.equal(parseDirectoryPresenceFilter("loading"), "all");
});

test("authorization failures drop cached private rows, transient failures do not", () => {
  for (const error of [{ status: 401 }, { status: 403 }, { code: "42501" }, { code: "PGRST301" }, { code: "PGRST302" }, { code: "PGRST303" }]) {
    assert.equal(isDirectoryAuthorizationError(error), true);
  }
  for (const error of [null, undefined, new Error("Network unavailable"), { status: 500 }, { code: "57014" }]) {
    assert.equal(isDirectoryAuthorizationError(error), false);
  }
});

test("denied cached refresh reaches terminal error after one request; transient retry budgets remain three or one", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  try {
    for (const denied of [{ status: 401 }, { status: 403 }, { code: "42501" }, { code: "PGRST301" }, { code: "PGRST302" }, { code: "PGRST303" }]) {
      const queryKey = ["synthetic-directory", JSON.stringify(denied)];
      client.setQueryData(queryKey, [{ id: "synthetic-cached-row" }]);
      let requests = 0;
      await assert.rejects(client.fetchQuery({
        queryKey,
        retry: shouldRetryDirectoryRead,
        queryFn: async () => { requests++; throw denied; },
      }), error => error === denied);
      assert.equal(requests, 1);
      const state = client.getQueryState(queryKey);
      assert.equal(state.status, "error");
      assert.equal(state.fetchStatus, "idle");
      assert.equal(isDirectoryAuthorizationError(state.error), true, "the directory mask can immediately discard cached rows");
      assert.equal(shouldRetryDirectoryRead(0, denied, 1), false, "optional counts must also avoid retrying denied access");
    }
    for (const retries of [3, 1]) {
      let requests = 0;
      await assert.rejects(client.fetchQuery({
        queryKey: ["synthetic-transient", retries],
        retry: (failureCount, error) => shouldRetryDirectoryRead(failureCount, error, retries),
        queryFn: async () => { requests++; throw new Error("Transient unavailable"); },
      }), /Transient unavailable/);
      assert.equal(requests, retries + 1);
    }
  } finally {
    client.clear();
  }
});
