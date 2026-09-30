// Synthetic browser fixtures for manual Argent QA. Never forwards backend traffic.
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const ids = { user: uuid(1), org: uuid(2), patient: uuid(3), driver: uuid(4), trip: uuid(5), driverUser: uuid(6) };

export function createWorkflowFixture({ role = "owner", status = "assigned", assignedDriver = false } = {}) {
  const createdAt = new Date().toISOString();
  const user = { id: ids.user, aud: "authenticated", role: "authenticated", email: "web-workflow-qa@example.invalid", created_at: createdAt, app_metadata: {}, user_metadata: {} };
  const patient = { id: ids.patient, org_id: ids.org, full_name: "Synthetic QA Rider", phone: null, email: null, user_id: null, created_at: createdAt, disabled: false, medicaid_id: "QA-ONLY" };
  const driver = { id: ids.driver, org_id: ids.org, full_name: "Synthetic QA Driver", phone: null, email: null, user_id: assignedDriver ? ids.user : ids.driverUser, created_at: createdAt, vehicle_info: "QA accessible van", vehicle_type: "wheelchair", vehicle_make: "QA", vehicle_model: "Van", license_plate: "QA-ONLY", is_active: true, current_lat: null, current_lng: null };
  const trip = { id: ids.trip, org_id: ids.org, patient_id: ids.patient, driver_id: ids.driver, pickup_location: "100 Synthetic Pickup Avenue, Minneapolis, MN", dropoff_location: "200 Synthetic Clinic Avenue, Minneapolis, MN", pickup_time: createdAt, trip_type: "one_way", status, notes: "Synthetic QA only. No real rider, trip, signature, or location.", distance_miles: 5.4, duration_minutes: 18, created_at: createdAt, updated_at: createdAt, actual_distance_miles: null, total_waiting_minutes: null, patient, driver };
  return { role, user, patient, driver, trip, history: [], requests: [], blockedRequests: [], nextRpcError: null };
}

function filterRows(rows, search) {
  return rows.filter(row => [...search].every(([key, value]) => {
    if (value.startsWith("eq.")) return String(row[key]) === value.slice(3);
    if (value.startsWith("in.(")) return value.slice(4, -1).split(",").includes(String(row[key]));
    if (value.startsWith("gte.")) return row[key] >= value.slice(4);
    if (value.startsWith("lte.")) return row[key] <= value.slice(4);
    if (value.startsWith("lt.")) return row[key] < value.slice(3);
    if (value.startsWith("is.")) return row[key] == null && value === "is.null";
    return true;
  }));
}

function projectRow(row, select) {
  if (!select || select === "*" || select.startsWith("*,")) return row;
  return Object.fromEntries(select.split(/,(?![^()]*\))/).map(column => {
    const relation = column.match(/^([^:()]+):[^()]+\((.*)\)$/);
    if (relation) return [relation[1], row[relation[1]] ? projectRow(row[relation[1]], relation[2]) : null];
    return [column, row[column]];
  }));
}

export async function installWorkflowFixtures(context, getState) {
  await context.addInitScript(({ user, org }) => {
    if (!["localhost", "127.0.0.1"].includes(location.hostname)) return;
    const expires = Math.floor(Date.now() / 1000) + 86400;
    const encode = (value) => btoa(JSON.stringify(value)).replaceAll("=", "").replaceAll("+", "-").replaceAll("/", "_");
    const session = { access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, aud: "authenticated", role: "authenticated", exp: expires })}.synthetic-qa`, refresh_token: "synthetic-qa-only", token_type: "bearer", expires_at: expires, expires_in: 86400, user };
    localStorage.setItem("future-transport-auth", JSON.stringify(session));
    localStorage.setItem("onboarding:dataState", "live");
    localStorage.setItem("onboarding:demoMode", "false");
    window.__webWorkflowQA = { synthetic: true, org };
    // Intentionally denied so office milestone verification catches GPS requests.
    const geolocation = {
      getCurrentPosition(_success, error) { window.__webWorkflowQA.locationRequests = (window.__webWorkflowQA.locationRequests || 0) + 1; error?.({ code: 1, message: "Location denied by synthetic QA fixture" }); },
      watchPosition(_success, error) { error?.({ code: 1, message: "Location denied by synthetic QA fixture" }); return 1; },
      clearWatch() {},
    };
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: geolocation });
  }, { user: getState().user, org: ids.org });

  await context.routeWebSocket(/^(?!ws:\/\/(localhost|127\.0\.0\.1):5173)/, socket => socket.close());
  await context.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const state = getState();
    if (["localhost", "127.0.0.1"].includes(url.hostname) && url.port === "5173") return route.continue();
    if (["fonts.googleapis.com", "fonts.gstatic.com"].includes(url.hostname) && request.method() === "GET") return route.continue();
    const isBackend = /\/(auth|rest|functions|storage)\/v1\//.test(url.pathname) || url.hostname.endsWith(".supabase.co");
    if (!isBackend) {
      state.blockedRequests.push({ method: request.method(), url: url.origin + url.pathname });
      return route.abort("blockedbyclient");
    }
    const body = request.postDataJSON();
    const safeSearch = new URLSearchParams(url.search);
    for (const key of ["apikey", "access_token", "token"]) if (safeSearch.has(key)) safeSearch.set(key, "redacted");
    state.requests.push({ method: request.method(), path: url.pathname, search: safeSearch.toString() ? `?${safeSearch}` : "", body, at: Date.now() });
    if (url.pathname.startsWith("/auth/")) return route.fulfill({ json: state.user });
    if (url.pathname.startsWith("/functions/")) return route.fulfill({ json: { synthetic: true, sent: false } });
    const name = url.pathname.split("/").at(-1);
    if (url.pathname.includes("/rpc/")) {
      if (name === "apply_trip_transition") {
        if (state.nextRpcError) {
          const error = state.nextRpcError;
          state.nextRpcError = null;
          return route.fulfill({ status: 409, json: error });
        }
        if (body.p_expected_status !== state.trip.status) return route.fulfill({ status: 409, json: { code: "40001", message: "Synthetic stale trip status" } });
        state.trip.status = body.p_new_status;
        state.trip.updated_at = new Date().toISOString();
        const fields = ["signature_data", "signed_by_name", "signature_declined", "signature_declined_reason", "cancel_reason", "cancel_explanation"];
        for (const field of fields) if (body[`p_${field}`] != null) state.trip[field] = body[`p_${field}`];
        if (body.p_new_status === "completed") state.trip.signature_captured_at = state.trip.updated_at;
        const event = { id: uuid(100 + state.history.length), trip_id: ids.trip, status: body.p_new_status, status_code: body.p_new_status, actor_id: ids.user, actor_name: "Synthetic QA Office", created_at: state.trip.updated_at, latitude: body.p_latitude, longitude: body.p_longitude, trigger_kind: body.p_trigger_kind, source_surface: body.p_source_surface, client_platform: body.p_client_platform, location_source: body.p_location_source, location_captured_at: body.p_location_captured_at, location_accuracy_m: body.p_location_accuracy_m };
        state.history.unshift(event);
        return route.fulfill({ json: event });
      }
      if (name === "dashboard_trip_buckets") {
        const pickup = new Date(state.trip.pickup_time);
        if (pickup < new Date(body.p_start) || pickup >= new Date(body.p_end)) return route.fulfill({ json: [] });
        const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: body.p_timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(pickup).map(part => [part.type, part.value]));
        const bucket = `${parts.year}-${parts.month}-${parts.day}${body.p_granularity === "hour" ? ` ${parts.hour}:00` : ""}`;
        const isActive = ["assigned", "accepted", "en_route", "arrived", "in_pickup_circle", "loaded", "in_progress", "in_dropoff_circle", "waiting"].includes(state.trip.status);
        return route.fulfill({ json: [{ bucket, total: 1, completed: Number(state.trip.status === "completed"), assigned: Number(isActive), pending: Number(state.trip.status === "pending"), cancelled: Number(state.trip.status === "cancelled"), no_show: Number(state.trip.status === "no_show") }] });
      }
      return route.fulfill({ json: null });
    }
    const createdAt = state.trip.created_at;
    const tables = {
      organizations: [{ id: ids.org, name: "Synthetic QA Transportation", created_at: createdAt, timezone: "America/Chicago", billing_enabled: true }],
      user_profiles: [{ user_id: ids.user, full_name: "Synthetic QA Office", default_org_id: ids.org, is_super_admin: false, phone: null, timezone: "America/Chicago", created_at: createdAt }],
      organization_memberships: [{ id: uuid(9), org_id: ids.org, user_id: ids.user, role: state.role, is_primary: true, created_at: createdAt }],
      patients: [state.patient], drivers: [state.driver], trips: [state.trip], trip_status_history: state.history,
      employees: [], org_uploads: [], notification_states: [], organization_fees: [], patient_credit_accounts: [],
      trip_cancellation_audits: state.trip.cancel_reason ? [{ id: uuid(10), trip_id: ids.trip, reason: state.trip.cancel_reason, explanation: state.trip.cancel_explanation, created_at: state.trip.updated_at }] : [],
    };
    let data = filterRows(tables[name] || [], url.searchParams);
    const count = request.method() === "HEAD" && ["patients", "drivers", "employees"].includes(name) ? 5 : data.length;
    if (url.searchParams.has("limit")) data = data.slice(0, Number(url.searchParams.get("limit")));
    if (request.method() === "PATCH" && name === "trips") Object.assign(state.trip, body);
    data = data.map(row => projectRow(row, url.searchParams.get("select")));
    const single = request.headers().accept?.includes("vnd.pgrst.object");
    return route.fulfill({ status: 200, headers: { "content-range": `0-${Math.max(0, data.length - 1)}/${count}`, "access-control-expose-headers": "content-range" }, ...(request.method() === "HEAD" ? { body: "" } : { json: single ? data[0] || null : data }) });
  });
}
