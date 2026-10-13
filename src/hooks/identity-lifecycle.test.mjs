import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const requirePackage = createRequire(import.meta.url);
function hookHarness() {
  let cursor = 0;
  const refs = [];
  const effects = [];
  let pending = [];
  return {
    react: {
      ...requirePackage("react"),
      useState(initial) {
        const index = cursor++;
        if (!(index in refs)) refs[index] = typeof initial === "function" ? initial() : initial;
        return [refs[index], (value) => { refs[index] = typeof value === "function" ? value(refs[index]) : value; }];
      },
      useCallback(fn, dependencies) {
        const index = cursor++;
        if (!refs[index] || dependencies.some((value, i) => !Object.is(value, refs[index].dependencies[i]))) refs[index] = { fn, dependencies };
        return refs[index].fn;
      },
      useRef(value) { const index = cursor++; return refs[index] ??= { current: value }; },
      useEffect(callback, dependencies) {
        const index = cursor++;
        if (!effects[index] || dependencies.some((value, i) => !Object.is(value, effects[index].dependencies[i]))) {
          pending.push({ index, callback, dependencies });
        }
      },
    },
    render(fn) {
      cursor = 0; const result = fn();
      for (const effect of pending) effects[effect.index]?.cleanup?.();
      for (const effect of pending) effects[effect.index] = { dependencies: effect.dependencies, cleanup: effect.callback() };
      pending = []; return result;
    },
    cleanup() { for (const effect of effects) effect?.cleanup?.(); },
  };
}
function loadSource(name, mocks, env = {}) {
  const url = new URL(name, import.meta.url);
  const source = readFileSync(url, "utf8").replaceAll("import.meta.env", JSON.stringify(env));
  const code = ts.transpileModule(source, { fileName: url.pathname, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exported = {};
  new Function("require", "exports", code)((id) => mocks[id] ?? requirePackage(id), exported);
  return exported;
}
function identity(overrides = {}) {
  return {
    auth: { user: { id: "user-a" }, bootstrap: { drivers: [{ id: "driver-a", user_id: "user-a", org_id: "org-a", active: true, disabled_at: null }] }, loading: false },
    org: { currentOrganization: { id: "org-a" }, userRole: "owner", loading: false },
    ...overrides,
  };
}
function locationHarness() {
  const harness = hookHarness();
  const state = identity();
  const watches = [];
  const cleared = [];
  const writes = [];
  const reads = [];
  const eta = [];
  let holdUpdate;
  let holdTrip;
  let holdEta;
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { geolocation: {
    watchPosition(callback) { watches.push(callback); return watches.length; },
    clearWatch(id) { cleared.push(id); },
  } } });
  const supabase = {
    from(table) {
      const request = { table, filters: {} };
      const query = {
        update(values) { request.values = values; writes.push(request); return query; },
        select() { reads.push(request); return query; }, eq(field, value) { request.filters[field] = value; return query; },
        abortSignal(signal) { request.signal = signal; return query; }, maybeSingle() { return query; },
        then(yes, no) { return Promise.resolve(table === "drivers" && holdUpdate ? holdUpdate : table === "trips" && holdTrip ? holdTrip : { data: table === "trips" ? { id: "trip-a" } : null, error: null }).then(yes, no); },
      }; return query;
    },
    functions: { invoke(name, args) { eta.push({ name, args }); return holdEta ?? Promise.resolve({ error: null }); } },
  };
  const hooks = loadSource("./useDriverLocation.ts", {
    react: harness.react,
    "@/contexts/auth-context": { useAuth: () => state.auth },
    "@/contexts/OrganizationContext": { useOrganization: () => state.org },
    "@/lib/supabase": { supabase },
  });
  return { ...harness, state, watches, cleared, writes, reads, eta, hooks,
    hold(promise) { holdUpdate = promise; }, holdTrip(promise) { holdTrip = promise; }, holdEta(promise) { holdEta = promise; } };
}
const position = { coords: { latitude: 44, longitude: -93 } };
const movedPosition = { coords: { latitude: 44.01, longitude: -93 } };
const flushTasks = () => new Promise((resolve) => setImmediate(resolve));

test("shared driver identity reads have no GPS or network side effects for any role", () => {
  const h = locationHarness();
  for (const role of ["owner", "admin", "dispatch", "driver", "employee"]) {
    h.state.org.userRole = role;
    assert.equal(h.render(h.hooks.useDriverIdentity).driverId, "driver-a");
  }
  h.state.org.currentOrganization.id = "org-b";
  assert.equal(h.render(h.hooks.useDriverIdentity).driverId, null);
  assert.equal(h.watches.length, 0);
  assert.equal(h.writes.length, 0);
  h.cleanup();
});

test("GPS requires explicit workflow activation plus authorized active same-org driver", () => {
  const h = locationHarness();
  h.render(() => h.hooks.useDriverLocation());
  assert.equal(h.watches.length, 0);
  h.state.org.userRole = "employee";
  h.render(() => h.hooks.useDriverLocation({ enabled: true }));
  assert.equal(h.watches.length, 0);
  h.state.org.userRole = "owner";
  h.state.auth.bootstrap.drivers[0].disabled_at = "2026-01-01";
  h.render(() => h.hooks.useDriverLocation({ enabled: true }));
  assert.equal(h.watches.length, 0);
  h.state.auth.bootstrap.drivers[0].disabled_at = null;
  h.render(() => h.hooks.useDriverLocation({ enabled: true }));
  h.render(() => h.hooks.useDriverLocation({ enabled: true }));
  assert.equal(h.watches.length, 1);
  h.cleanup(); assert.deepEqual(h.cleared, [1]);
});

test("stopping GPS aborts an in-flight write and prevents old callbacks and ETA/SMS", async () => {
  const h = locationHarness();
  let resolve;
  h.hold(new Promise((r) => { resolve = r; }));
  h.render(() => h.hooks.useDriverLocation({ enabled: true }));
  const pending = h.watches[0](position);
  await Promise.resolve();
  h.state.org.currentOrganization = { id: "org-b" };
  h.render(() => h.hooks.useDriverLocation({ enabled: true }));
  assert.equal(h.writes[0].signal.aborted, true);
  resolve({ error: null }); await pending;
  await h.watches[0](position);
  assert.equal(h.writes.length, 1);
  assert.equal(h.eta.length, 0);
  assert.deepEqual(h.writes[0].filters, { id: "driver-a", org_id: "org-a", user_id: "user-a" });
  h.cleanup();
});

test("token refresh does not restart GPS; a valid workflow preserves ETA checks", async () => {
  const h = locationHarness();
  h.render(() => h.hooks.useDriverLocation({ enabled: true }));
  h.state.auth.user = { id: "user-a" };
  h.render(() => h.hooks.useDriverLocation({ enabled: true }));
  assert.equal(h.watches.length, 1);
  await h.watches[0](position);
  await flushTasks();
  assert.equal(h.writes.length, 1);
  assert.equal(h.eta[0].name, "send_eta_sms");
  h.cleanup();
});

test("stalled trip lookup or ETA/SMS never blocks GPS writes or creates duplicate ETA tasks", async () => {
  for (const stage of ["lookup", "sms"]) {
    const h = locationHarness();
    let resolve;
    const held = new Promise((done) => { resolve = done; });
    if (stage === "lookup") h.holdTrip(held); else h.holdEta(held);
    try {
      h.render(() => h.hooks.useDriverLocation({ enabled: true }));
      await h.watches[0](position);
      await flushTasks();
      assert.equal(h.reads.length, 1);
      assert.equal(h.eta.length, stage === "sms" ? 1 : 0);
      await h.watches[0](movedPosition);
      await flushTasks();
      assert.equal(h.writes.length, 2, `GPS must continue during stalled ${stage}`);
      assert.equal(h.writes[1].values.current_lat, movedPosition.coords.latitude);
      assert.equal(h.reads.length, 1, "only one ETA task may be in flight");
      h.cleanup();
      const signal = stage === "lookup" ? h.reads[0].signal : h.eta[0].args.signal;
      assert.equal(signal.aborted, true);
    } finally {
      h.cleanup();
      resolve({ data: { id: "trip-a" }, error: null });
      await flushTasks();
    }
    assert.equal(h.eta.length, stage === "sms" ? 1 : 0, "cleanup must not continue a late lookup into SMS");
  }
});

test("changing drivers aborts old ETA work while the new identity can update and check ETA", async () => {
  const h = locationHarness();
  let resolve;
  h.holdTrip(new Promise((done) => { resolve = done; }));
  try {
    h.render(() => h.hooks.useDriverLocation({ enabled: true }));
    await h.watches[0](position);
    await flushTasks();
    const oldLookup = h.reads[0];
    h.state.auth.bootstrap.drivers = [{ id: "driver-b", user_id: "user-a", org_id: "org-b", active: true, disabled_at: null }];
    h.state.org.currentOrganization = { id: "org-b" };
    h.holdTrip(null);
    h.render(() => h.hooks.useDriverLocation({ enabled: true }));
    assert.equal(oldLookup.signal.aborted, true);
    await h.watches[0](movedPosition);
    assert.equal(h.writes.length, 1, "the old GPS callback stays stopped");
    await h.watches[1](position);
    await flushTasks();
    assert.deepEqual(h.writes[1].filters, { id: "driver-b", org_id: "org-b", user_id: "user-a" });
    assert.deepEqual(h.reads[1].filters, { org_id: "org-b", driver_id: "driver-b", status: "en_route" });
    assert.equal(h.eta.length, 1);
    resolve({ data: { id: "old-trip" }, error: null });
    await flushTasks();
    assert.equal(h.eta.length, 1, "a late old lookup must not send another ETA request");
  } finally { h.cleanup(); resolve({ data: null, error: null }); }
});

test("ETA timeout aborts a stalled lookup and late results cannot trigger SMS", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const h = locationHarness();
  let resolve;
  h.holdTrip(new Promise((done) => { resolve = done; }));
  try {
    h.render(() => h.hooks.useDriverLocation({ enabled: true }));
    await h.watches[0](position);
    await flushTasks();
    t.mock.timers.tick(30_000);
    assert.equal(h.reads[0].signal.aborted, true);
    resolve({ data: { id: "expired-trip" }, error: null });
    await flushTasks();
    assert.equal(h.eta.length, 0);
    h.holdTrip(null);
    await h.watches[0](movedPosition);
    await flushTasks();
    assert.equal(h.writes.length, 2);
    assert.equal(h.eta.length, 1, "a settled timeout permits a subsequent bounded check");
  } finally { h.cleanup(); resolve({ data: null, error: null }); }
});

test("presence switch cleans the original company and refreshed tokens do not duplicate setup", async () => {
  const h = hookHarness();
  const state = identity();
  state.auth.session = { user: state.auth.user, access_token: "fixture-token-a" };
  const rpc = [];
  const offline = [];
  globalThis.window = new EventTarget();
  globalThis.document = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (url, options) => { offline.push({ url, ...options, body: JSON.parse(options.body) }); return Promise.resolve({ ok: true }); };
  const { usePresence } = loadSource("./usePresence.ts", {
    react: h.react,
    "@/contexts/auth-context": { useAuth: () => state.auth },
    "@/contexts/OrganizationContext": { useOrganization: () => state.org },
    "@/lib/supabase": { supabase: { rpc(name, args) { rpc.push({ name, args }); return Promise.resolve({ error: null }); } } },
  }, { VITE_SUPABASE_URL: "https://fixture.invalid", VITE_SUPABASE_ANON_KEY: "fixture-public-key" });
  try {
    h.render(usePresence); await Promise.resolve();
    state.auth.user = { id: "user-a" };
    state.auth.session = { user: state.auth.user, access_token: "fixture-refreshed-token" };
    h.render(usePresence); await Promise.resolve();
    assert.equal(rpc.length, 1);
    assert.equal(offline.length, 0);
    state.org.currentOrganization = { id: "org-b" };
    h.render(usePresence); await Promise.resolve();
    assert.deepEqual(offline[0].body, { p_user_id: "user-a", p_org_id: "org-a", p_status: "offline" });
    assert.equal(offline[0].headers.Authorization, "Bearer fixture-refreshed-token");
    assert.doesNotMatch(offline[0].url, /apikey|token/);
    assert.equal(rpc.at(-1).args.p_org_id, "org-b");
    h.cleanup(); assert.equal(offline.at(-1).body.p_org_id, "org-b");
  } finally { globalThis.fetch = originalFetch; }
});

test("permissions deny unresolved identity and unset founder config cannot authorize signed-out users", () => {
  const state = identity();
  const { usePermissions } = loadSource("./usePermissions.ts", {
    "@/contexts/auth-context": { useAuth: () => state.auth },
    "@/contexts/OrganizationContext": { useOrganization: () => state.org },
  });
  state.auth.user = null; state.org.userRole = null;
  assert.equal(usePermissions().isSuperAdmin, false);
  assert.equal(usePermissions().can("view_trips"), false);
  state.auth.user = { id: "user-a" }; state.org.userRole = "owner"; state.auth.loading = true;
  assert.equal(usePermissions().isOwner, false);
  state.auth.loading = false; state.org.loading = true;
  assert.equal(usePermissions().can("view_trips"), false);
  state.org.loading = false;
  assert.equal(usePermissions().can("view_trips"), true);
  state.auth.error = new Error("Membership revoked");
  assert.equal(usePermissions().can("view_trips"), false);
});

function authHarness() {
  const h = hookHarness();
  const reads = [];
  const cancellations = [];
  let listener;
  let resolveLogout;
  const supabase = { auth: {
    onAuthStateChange(callback) { listener = callback; return { data: { subscription: { unsubscribe() { listener = undefined; } } } }; },
    getSession() { return new Promise((resolve, reject) => reads.push({ resolve, reject })); },
    signOut() { return new Promise((resolve) => { resolveLogout = resolve; }); },
  } };
  const { AuthProvider } = loadSource("../contexts/auth-context.tsx", {
    react: h.react,
    "@/lib/supabase": { supabase },
    "@tanstack/react-query": { useQueryClient: () => "query-client", useQuery: () => ({ data: undefined, isPending: true, error: null }) },
    "@/lib/identity-bootstrap": {
      clearPrivateQueries(client) { cancellations.push(client); },
      identityQueryKey: (id) => ["identity", id], fetchIdentityBootstrap() {}, reconcileIdentityAccess: (_client, value) => value,
    },
    "@/lib/startup-performance": { markStartup() {} },
  });
  return { ...h, reads, cancellations,
    value: () => h.render(() => AuthProvider({ children: null })).props.value,
    event(event, session) { listener(event, session); },
    finishLogout(error = null) { resolveLogout({ error }); },
  };
}

test("a delayed initial session never resurrects the user after local sign-out", async () => {
  const h = authHarness();
  h.value();
  const session = { user: { id: "user-a" }, access_token: "fixture-token" };
  h.event("SIGNED_IN", session);
  const logout = h.value().signOut();
  assert.equal(h.value().user, null);
  h.reads[0].resolve({ data: { session }, error: null });
  await Promise.resolve();
  assert.equal(h.value().user, null);
  h.finishLogout(); await logout; h.cleanup();
});

test("session error retry actually reads a new session, and a newer auth event wins", async () => {
  const h = authHarness(); h.value();
  h.reads[0].reject(new Error("Network offline"));
  await Promise.resolve(); await Promise.resolve();
  assert.match(h.value().error.message, /Unable to resolve/);
  const retry = h.value().refresh();
  assert.equal(h.reads.length, 2);
  assert.equal(h.value().loading, true);
  const current = { user: { id: "user-b" }, access_token: "fixture-b" };
  h.event("SIGNED_IN", current);
  h.reads[1].resolve({ data: { session: { user: { id: "stale-user" } } }, error: null });
  await retry;
  assert.equal(h.value().user.id, "user-b");
  assert.equal(h.value().error, null);
  h.cleanup();
});

test("token refresh preserves current cache, but multi-tab account changes clear it", () => {
  const h = authHarness(); h.value();
  h.event("SIGNED_IN", { user: { id: "user-a" }, access_token: "first" });
  h.value(); const initial = h.cancellations.length;
  h.event("TOKEN_REFRESHED", { user: { id: "user-a" }, access_token: "second" });
  h.value(); assert.equal(h.cancellations.length, initial);
  h.event("SIGNED_IN", { user: { id: "user-b" }, access_token: "other-account" });
  h.value(); assert.equal(h.cancellations.length, initial + 1);
  h.event("SIGNED_OUT", null);
  assert.equal(h.value().user, null);
  assert.equal(h.cancellations.length, initial + 2);
  h.cleanup();
});


test("refresh completion during pending logout cannot remount a private session", async () => {
  const h = authHarness(); h.value();
  h.event("SIGNED_IN", { user: { id: "user-a" }, access_token: "first" });
  const logout = h.value().signOut();
  h.event("TOKEN_REFRESHED", { user: { id: "user-a" }, access_token: "new-token" });
  assert.equal(h.value().user, null);
  assert.equal(h.value().loading, true);
  h.finishLogout(new Error("Offline")); await logout;
  assert.match(h.value().error.message, /sign out/);
  h.event("TOKEN_REFRESHED", { user: { id: "user-a" }, access_token: "another-token" });
  assert.equal(h.value().user, null);
  const retry = h.value().refresh();
  h.finishLogout(); await retry;
  assert.equal(h.value().user, null);
  assert.equal(h.value().loading, false);
  assert.equal(h.value().error, null);
  h.cleanup();
});
