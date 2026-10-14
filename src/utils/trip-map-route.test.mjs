import assert from "node:assert/strict";
import test from "node:test";

import { fetchPrimaryDrivingRoute } from "./trip-map-route.ts";

const pickupAddress = "111 Pickup Street, Minneapolis, MN";
const dropoffAddress = "222 Drop-off Avenue, Minneapolis, MN";
const endpoints = { pickupAddress, dropoffAddress };
const primaryPolyline = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";

const mapsLoader = (route) => async () => ({
  DirectionsService: class {
    route(request) {
      return route(request);
    }
  },
  TravelMode: { DRIVING: "DRIVING" },
});

test("requests one driving route from address endpoints and returns only the primary overview", async () => {
  const requests = [];
  const result = await fetchPrimaryDrivingRoute(endpoints, mapsLoader(async (request) => {
    requests.push(request);
    return { routes: [
      { overview_polyline: primaryPolyline },
      { overview_polyline: "must-not-render-alternative" },
    ] };
  }));
  assert.equal(result, primaryPolyline);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].origin, pickupAddress);
  assert.equal(requests[0].destination, dropoffAddress);
  assert.equal(requests[0].travelMode, "DRIVING");
  assert.equal(requests[0].provideRouteAlternatives, false);
});

test("route endpoints prefer complete coordinates and sanitize fallback addresses", async () => {
  let request;
  const result = await fetchPrimaryDrivingRoute({
    pickupLat: "44.98",
    pickupLng: "-93.27",
    pickupAddress,
    dropoffLat: null,
    dropoffLng: -93.1,
    dropoffAddress: "  C&D Clinic | Suite #2 + Annex\nMinneapolis, MN ",
  }, mapsLoader(async (input) => {
    request = input;
    return { routes: [{ overview_polyline: primaryPolyline }] };
  }));
  assert.equal(result, primaryPolyline);
  assert.equal(request.origin, "44.98,-93.27");
  assert.equal(request.destination, "C&D Clinic Suite #2 + Annex Minneapolis, MN");
});

test("does not load the SDK when either route endpoint is unavailable", async () => {
  let loads = 0;
  const loadMaps = async () => {
    loads += 1;
    throw new Error("must not load without two endpoints");
  };
  for (const data of [{}, { pickupAddress }, { dropoffAddress }, {
    pickupLat: 0,
    pickupLng: 0,
    dropoffAddress,
  }]) {
    assert.equal(await fetchPrimaryDrivingRoute(data, loadMaps), null);
  }
  assert.equal(loads, 0);
});

test("does not substitute an alternative when the primary route has no overview", async () => {
  for (const routes of [
    [],
    [{}],
    [{ overview_polyline: "" }],
    [{}, { overview_polyline: "alternative-only" }],
  ]) {
    assert.equal(await fetchPrimaryDrivingRoute(
      endpoints,
      mapsLoader(async () => ({ routes })),
    ), null);
  }
});

test("a rejected driving request leaves the route unavailable", async () => {
  const result = await fetchPrimaryDrivingRoute(endpoints, mapsLoader(async () => {
    throw new Error("ZERO_RESULTS");
  }));
  assert.equal(result, null);
});

test("an SDK loading failure leaves the route unavailable", async () => {
  const result = await fetchPrimaryDrivingRoute(endpoints, async () => {
    throw new Error("SDK unavailable");
  });
  assert.equal(result, null);
});

test("a stalled driving request times out without blocking PDF generation", { timeout: 1_000 }, async () => {
  const result = await fetchPrimaryDrivingRoute(
    endpoints,
    mapsLoader(() => new Promise(() => {})),
    20,
  );
  assert.equal(result, null);
});

test("a stalled SDK load times out without blocking PDF generation", { timeout: 1_000 }, async () => {
  const result = await fetchPrimaryDrivingRoute(endpoints, () => new Promise(() => {}), 20);
  assert.equal(result, null);
});

test("an SDK load that finishes after timeout does not start a late directions request", { timeout: 1_000 }, async () => {
  let resolveMaps;
  let routeRequests = 0;
  const maps = await mapsLoader(async () => {
    routeRequests += 1;
    return { routes: [{ overview_polyline: primaryPolyline }] };
  })();
  const result = await fetchPrimaryDrivingRoute(
    endpoints,
    () => new Promise((resolve) => { resolveMaps = resolve; }),
    20,
  );
  assert.equal(result, null);
  resolveMaps(maps);
  await new Promise(setImmediate);
  assert.equal(routeRequests, 0);
});
