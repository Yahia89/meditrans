const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const ids = { userA: uuid(801), userB: uuid(802), orgA: uuid(803), orgB: uuid(804), patientA: uuid(805), driverA: uuid(806) };
const createdAt = "2026-01-01T12:00:00Z";
export const users = {
  a: { id: ids.userA, email: "startup-a@example.invalid", role: "authenticated", aud: "authenticated", created_at: createdAt, app_metadata: {}, user_metadata: {} },
  b: { id: ids.userB, email: "startup-b@example.invalid", role: "authenticated", aud: "authenticated", created_at: createdAt, app_metadata: {}, user_metadata: {} },
};
const organization = (id, name) => ({ id, name, created_at: createdAt, timezone: "America/Chicago", npi: null, tax_id: null,
  billing_state: null, billing_enabled: true, brokers_enabled: false, sftp_enabled: false, mn_its_submitter_id: null });
export const organizations = { a: organization(ids.orgA, "Startup Alpha Company"), b: organization(ids.orgB, "Startup Beta Company") };
export function syntheticSession(user = users.a, expired = false) {
  const exp = Math.floor(Date.now() / 1000) + (expired ? -3600 : 86400);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return { access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, role: "authenticated", aud: "authenticated", exp })}.synthetic-only`,
    refresh_token: "synthetic-startup-only", token_type: "bearer", expires_at: exp, expires_in: expired ? -3600 : 86400, user };
}
export const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
export function createStartupState(overrides = {}) {
  return { current: "a", role: "owner", hasMembership: true, hasDriver: false, driverDisabled: false,
    defaultOrg: "a", multiOrg: false, hiddenOrganization: false, membershipError: false, membershipGate: null, requests: [], blocked: [], ...overrides };
}
export function identityDriverRequests(state) {
  return state.requests.filter((request) => request.table === "drivers" && request.search.has("user_id"));
}
function accountFromRequest(request, state) {
  const authorization = request.headers().authorization ?? "";
  try {
    const userId = JSON.parse(Buffer.from(authorization.split(".")[1], "base64url").toString()).sub;
    return userId === ids.userB ? "b" : "a";
  } catch { return state.current; }
}
function project(row, select) {
  if (!select || select === "*" || select.startsWith("*,")) return row;
  return Object.fromEntries(select.split(/,(?![^()]*\))/).map((column) => {
    const relation = column.match(/^([^:()]+):[^()]+\((.*)\)$/);
    return relation ? [relation[1], row[relation[1]] ? project(row[relation[1]], relation[2]) : null] : [column, row[column]];
  }));
}

export async function installStartupFixtures(context, state, { signedOut = false, expired = false } = {}) {
  await context.addInitScript(({ session }) => {
    if (!localStorage.getItem("startup-fixture-seeded")) {
      if (session) localStorage.setItem("future-transport-auth", JSON.stringify(session));
      else localStorage.removeItem("future-transport-auth");
      localStorage.setItem("startup-fixture-seeded", "true");
      localStorage.setItem("onboarding:isDemoMode", "false");
    }
    window.__startupLocationWatches = 0;
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
      watchPosition() { window.__startupLocationWatches++; return 1; }, clearWatch() {},
      getCurrentPosition(_ok, fail) { fail?.({ code: 1, message: "Synthetic location denied" }); },
    } });
  }, { session: signedOut ? null : syntheticSession(users[state.current], expired) });
  await context.routeWebSocket(/.*/, (socket) => socket.close());
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (["localhost", "127.0.0.1"].includes(url.hostname) && url.port === "5184") return route.continue();
    // Every remote request is intercepted; this suite cannot write real data.
    if (!/\/(auth|rest|functions|storage)\/v1\//.test(url.pathname)) {
      state.blocked.push(url.origin + url.pathname); return route.abort("blockedbyclient");
    }
    const table = url.pathname.split("/").at(-1);
    const search = url.searchParams;
    state.requests.push({ table, method: request.method(), path: url.pathname, search });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (url.pathname.startsWith("/auth/")) {
      if (table === "token") return route.fulfill({ json: syntheticSession(users[state.current]) });
      if (table === "logout") return route.fulfill({ status: 204 });
      return route.fulfill({ json: users[state.current] });
    }
    if (url.pathname.includes("/rpc/")) return route.fulfill({ json: table === "dashboard_trip_buckets" ? [] : null });
    if (url.pathname.startsWith("/functions/")) return route.fulfill({ json: { synthetic: true } });
    const account = accountFromRequest(request, state);
    const user = users[account];
    const selectedOrg = account === "b" ? organizations.b : organizations[state.defaultOrg];
    if (table === "organization_memberships") {
      if (state.membershipGate) await state.membershipGate.promise;
      if (state.membershipError) return route.fulfill({ status: 503, json: { code: "SYNTHETIC_UNAVAILABLE", message: "Synthetic membership unavailable" } });
    }
    const authorizedOrgs = state.hasMembership ? (account === "a" && state.multiOrg ? [organizations.a, organizations.b] : [selectedOrg]) : [];
    const patient = { id: ids.patientA, org_id: ids.orgA, full_name: "Alpha Private Fixture Rider", phone: null, email: null,
      user_id: null, created_at: createdAt, disabled: false, monthly_credit: 0, medicaid_id: "SYNTHETIC" };
    const driver = { id: ids.driverA, org_id: ids.orgA, user_id: ids.userA, full_name: "Synthetic Startup Driver", phone: null,
      active: !state.driverDisabled, disabled_at: state.driverDisabled ? createdAt : null };
    const rows = {
      user_profiles: [{ user_id: user.id, full_name: account === "a" ? "Startup Alpha User" : "Startup Beta User", phone: null,
        created_at: createdAt, default_org_id: selectedOrg.id, timezone: "America/Chicago", is_super_admin: false }],
      organization_memberships: authorizedOrgs.map((org, index) => ({ id: uuid(820 + index), org_id: org.id,
        user_id: user.id, role: state.role, is_primary: org.id === selectedOrg.id, created_at: createdAt, organization: state.hiddenOrganization ? null : org })),
      organizations: authorizedOrgs,
      drivers: state.hasDriver && account === "a" ? [driver] : [],
      patients: authorizedOrgs.some((org) => org.id === ids.orgA) ? [patient] : [],
    }[table] ?? [];
    let data = rows.filter((row) => [...search].every(([key, value]) => !value.startsWith("eq.") || String(row[key]) === value.slice(3)));
    if (search.has("limit")) data = data.slice(0, Number(search.get("limit")));
    data = data.map((row) => project(row, search.get("select")));
    const single = request.headers().accept?.includes("vnd.pgrst.object");
    await route.fulfill({ status: 200, headers: { "content-range": `0-${Math.max(0, data.length - 1)}/${data.length}` },
      ...(request.method() === "HEAD" ? { body: "" } : { json: single ? data[0] ?? null : data }) });
  });
}

export async function broadcastSession(page, event, session) {
  await page.evaluate(({ event, session }) => {
    if (session) localStorage.setItem("future-transport-auth", JSON.stringify(session));
    else localStorage.removeItem("future-transport-auth");
    const channel = new BroadcastChannel("future-transport-auth");
    channel.postMessage({ event, session });
    channel.close();
  }, { event, session });
}

export async function revalidateIdentity(page) {
  // Query's real freshness/focus policy, with a controlled clock (no sleep).
  await page.clock.fastForward(5 * 60_000 + 1);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
  });
}
