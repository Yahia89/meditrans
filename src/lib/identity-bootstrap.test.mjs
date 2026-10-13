import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import {
  fetchIdentityBootstrap, identityQueryKey, resolveOrganization, clearPrivateQueries, reconcileIdentityAccess,
  ORGANIZATION_SUMMARY_FIELDS, PROFILE_FIELDS, DRIVER_IDENTITY_FIELDS,
} from "./identity-bootstrap.ts";
import { ONBOARDING_LIMITS, onboardingDataState } from "./onboarding-summary.ts";

const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const org = (id) => ({ id, name: id, created_at: "2026-01-01", timezone: "America/Chicago", npi: null, tax_id: null, billing_state: null, billing_enabled: true, brokers_enabled: false, sftp_enabled: false, mn_its_submitter_id: null });
const membership = (userId, orgId, primary = false) => ({ id: `${userId}:${orgId}`, created_at: "2026-01-01", user_id: userId, org_id: orgId, role: "owner", is_primary: primary, organization: org(orgId) });
function mockClient(respond) {
  const requests = [];
  return {
    requests,
    from(table) {
      const request = { table, filters: {} }; requests.push(request);
      const query = {
        select(fields) { request.fields = fields; return query; },
        eq(key, value) { request.filters[key] = value; return query; },
        abortSignal(signal) { request.signal = signal; return query; },
        maybeSingle() { return query; }, order() { return query; },
        then(yes, no) { return Promise.resolve(respond(request)).then(yes, no); },
      };
      return query;
    },
  };
}
function response(request) {
  if (request.table === "organization_memberships") return { data: [membership(request.filters.user_id, "org-a", true)], error: null };
  return { data: request.table === "drivers" ? [] : null, error: null };
}
const options = (client, userId) => ({ queryKey: identityQueryKey(userId), queryFn: ({ signal }) => fetchIdentityBootstrap(client, userId, signal), staleTime: Infinity, retry: false });

test("simultaneous identity consumers share one set of reads and cache a null driver", async () => {
  const queryClient = new QueryClient();
  const gate = deferred();
  const client = mockClient(async (request) => { await gate.promise; return response(request); });
  const reads = Array.from({ length: 4 }, () => queryClient.fetchQuery(options(client, "user-a")));
  await Promise.resolve();
  assert.equal(client.requests.length, 3);
  gate.resolve();
  const values = await Promise.all(reads);
  assert.equal(values[0], values[3]);
  assert.deepEqual(values[0].drivers, []);
  await queryClient.fetchQuery(options(client, "user-a"));
  assert.equal(client.requests.length, 3);
  assert.equal(client.requests.filter((request) => request.table === "drivers").length, 1);
  queryClient.clear();
});

test("a slow first account never blocks or populates a second account", async () => {
  const queryClient = new QueryClient();
  const gate = deferred();
  const client = mockClient(async (request) => {
    if (request.filters.user_id === "user-a") await gate.promise;
    return response(request);
  });
  const first = queryClient.fetchQuery(options(client, "user-a")).catch((error) => error);
  await Promise.resolve();
  clearPrivateQueries(queryClient);
  const second = await queryClient.fetchQuery(options(client, "user-b"));
  assert.equal(second.userId, "user-b");
  assert.equal(client.requests.filter((request) => request.filters.user_id === "user-a").every((request) => request.signal.aborted), true);
  gate.resolve();
  await first;
  assert.equal(queryClient.getQueryData(identityQueryKey("user-a")), undefined);
  assert.equal(queryClient.getQueryData(identityQueryKey("user-b")).userId, "user-b");
  queryClient.clear();
});

test("sign-out cancels all private reads, removes data and ignores late responses", async () => {
  const queryClient = new QueryClient();
  const gate = deferred();
  const client = mockClient(async (request) => { await gate.promise; return response(request); });
  const pending = queryClient.fetchQuery(options(client, "user-a")).catch((error) => error);
  queryClient.setQueryData(["legacy-detail", "record"], { private: true });
  clearPrivateQueries(queryClient);
  gate.resolve(); await pending;
  assert.equal(queryClient.getQueryCache().getAll().length, 0);
});

test("tenant switching clears feature caches including legacy unscoped keys but keeps identity", () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(identityQueryKey("user-a"), { userId: "user-a" });
  queryClient.setQueryData(["trips", "org-a"], ["private"]);
  queryClient.setQueryData(["detail", "record-id"], { private: true });
  clearPrivateQueries(queryClient, true);
  assert.deepEqual(queryClient.getQueryCache().getAll().map((query) => query.queryKey), [identityQueryKey("user-a")]);
  queryClient.clear();
});

test("membership errors fail bootstrap instead of authorizing an empty organization", async () => {
  const client = mockClient((request) => request.table === "organization_memberships" ? { data: null, error: new Error("Denied") } : response(request));
  await assert.rejects(fetchIdentityBootstrap(client, "user-a", new AbortController().signal), /Denied/);
});

test("owner/admin driver association is retained and profile fallback does not grant super-admin", async () => {
  const client = mockClient((request) => request.table === "drivers" ? { data: [{ id: "driver-a", user_id: "user-a", org_id: "org-a", full_name: "Fixture driver", phone: null, active: true, disabled_at: null }], error: null } : response(request));
  const bootstrap = await fetchIdentityBootstrap(client, "user-a", new AbortController().signal);
  assert.equal(bootstrap.memberships[0].role, "owner");
  assert.equal(bootstrap.drivers[0].id, "driver-a");
  assert.equal(bootstrap.profile.is_super_admin, false);
  assert.equal(bootstrap.profile.timezone, null);
});

test("organization defaults and explicit switches never select an unvalidated tenant/user", () => {
  const bootstrap = { userId: "user-a", profile: { default_org_id: "org-b" }, memberships: [membership("user-a", "org-a", true), membership("user-a", "org-b")], organizations: [org("org-a"), org("org-b"), org("unrelated")], drivers: [] };
  assert.equal(resolveOrganization(undefined, null), null);
  assert.equal(resolveOrganization(bootstrap, null).id, "org-b");
  assert.equal(resolveOrganization(bootstrap, { userId: "user-a", orgId: "org-a" }).id, "org-a");
  assert.equal(resolveOrganization(bootstrap, { userId: "previous-user", orgId: "org-a" }).id, "org-b");
  assert.equal(resolveOrganization(bootstrap, { userId: "user-a", orgId: "unrelated" }).id, "org-b");
  assert.equal(resolveOrganization({ ...bootstrap, memberships: [] }, null), null);
  assert.equal(resolveOrganization({ ...bootstrap, profile: { default_org_id: "removed-org" } }, null).id, "org-a");
});

test("shell selects explicit fields and excludes integration credentials", () => {
  for (const fields of [ORGANIZATION_SUMMARY_FIELDS, PROFILE_FIELDS, DRIVER_IDENTITY_FIELDS]) {
    assert.doesNotMatch(fields, /\*|password|secret|token|sftp_host|sftp_username/);
  }
});

test("bounded checklist reads preserve all original thresholds including totals beyond API limits", () => {
  for (const patients of [0, 1, 2, 4, 5, 6, 1001, 100000]) {
    for (const drivers of [0, 1, 2, 4, 5, 6, 1001]) {
      for (const employees of [0, 1, 2, 4, 5, 6, 1001]) {
        for (const trips of [0, 1, 1001]) {
          const exact = { patients, drivers, employees, trips };
          const capped = Object.fromEntries(Object.entries(exact).map(([key, count]) => [key, Math.min(count, ONBOARDING_LIMITS[key])]));
          assert.equal(onboardingDataState(capped), onboardingDataState(exact));
          assert.equal(capped.patients >= 5 || capped.drivers >= 5, patients >= 5 || drivers >= 5);
        }
      }
    }
  }
});


test("revoked memberships and default-company changes clear feature cache before the new identity is published", () => {
  for (const change of [
    (identity) => ({ ...identity, memberships: [] }),
    (identity) => ({ ...identity, memberships: identity.memberships.map((row) => ({ ...row, role: "driver" })) }),
    (identity) => ({ ...identity, profile: { default_org_id: "org-b" } }),
  ]) {
    const queryClient = new QueryClient();
    const current = { userId: "user-a", profile: null, memberships: [membership("user-a", "org-a")], organizations: [org("org-a")], drivers: [] };
    queryClient.setQueryData(identityQueryKey("user-a"), current);
    queryClient.setQueryData(["legacy-record-detail"], { private: true });
    reconcileIdentityAccess(queryClient, change(current));
    assert.equal(queryClient.getQueryData(["legacy-record-detail"]), undefined);
    assert.equal(queryClient.getQueryData(identityQueryKey("user-a")), current);
    queryClient.clear();
  }
});
