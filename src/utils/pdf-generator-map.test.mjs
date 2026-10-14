import assert from "node:assert/strict";
import test from "node:test";

import { loadTripMap } from "./pdf-generator.ts";
import { generateStaticMapUrl } from "./static-map-generator.ts";

const pickupAddress = "111 Pickup Street, Minneapolis, MN";
const dropoffAddress = "222 Drop-off Avenue, Minneapolis, MN";
const mapImage = "data:image/png;base64,synthetic-map";
const noRoute = async () => null;
const trip = {
  id: "synthetic-trip-id",
  status: "completed",
  pickup_location: pickupAddress,
  dropoff_location: dropoffAddress,
  pickup_lat: null,
  pickup_lng: null,
  dropoff_lat: null,
  dropoff_lng: null,
};

const captureMap = () => {
  const calls = [];
  return {
    calls,
    fetchMap: async (data, width, height) => {
      const url = generateStaticMapUrl(data, width, height, "test-key");
      assert.ok(url, "the PDF must request a map with two resolvable endpoints");
      calls.push(new URL(url).searchParams.getAll("markers"));
      return mapImage;
    },
  };
};

test("PDF map loading requests the address-based map when all stored coordinates are null", async () => {
  const { calls, fetchMap } = captureMap();
  const result = await loadTripMap(trip, null, fetchMap, noRoute);
  assert.deepEqual(calls, [[
    `color:green|label:A|${pickupAddress}`,
    `color:red|label:B|${dropoffAddress}`,
  ]]);
  assert.equal(result.image, mapImage);
  assert.match(result.caption, /^Pickup \(A\) and drop-off \(B\)/);
  assert.match(result.caption, /address used/i);
  assert.equal(result.unavailableReason, null);
});

test("PDF map loading combines a recorded pickup with the drop-off address", async () => {
  const { calls, fetchMap } = captureMap();
  const result = await loadTripMap({ ...trip, pickup_lat: 44.98, pickup_lng: -93.27 }, null, fetchMap, noRoute);
  assert.deepEqual(calls, [[
    "color:green|label:A|44.98,-93.27",
    `color:red|label:B|${dropoffAddress}`,
  ]]);
  assert.equal(result.image, mapImage);
});

test("PDF map loading combines a pickup address with a recorded drop-off", async () => {
  const { calls, fetchMap } = captureMap();
  await loadTripMap({ ...trip, dropoff_lat: 44.95, dropoff_lng: -93.1 }, null, fetchMap, noRoute);
  assert.deepEqual(calls, [[
    `color:green|label:A|${pickupAddress}`,
    "color:red|label:B|44.95,-93.1",
  ]]);
});

test("PDF map loading does not fetch when an endpoint has neither usable coordinates nor an address", async () => {
  for (const missing of [
    { pickup_location: null },
    { dropoff_location: " \t " },
    { pickup_location: "| |" },
  ]) {
    const { calls, fetchMap } = captureMap();
    let routeRequested = false;
    const result = await loadTripMap({ ...trip, ...missing }, null, fetchMap, async () => {
      routeRequested = true;
      return null;
    });
    assert.equal(calls.length, 0);
    assert.equal(routeRequested, false);
    assert.equal(result.image, null);
    assert.ok(result.unavailableReason);
  }
});

test("cancelled and no-show PDFs use the recorded cancellation location even without pickup coordinates or an address", async () => {
  for (const status of ["cancelled", "no_show"]) {
    const { calls, fetchMap } = captureMap();
    const result = await loadTripMap(
      { ...trip, status, pickup_location: null },
      { location_lat: 44.99, location_lng: -93.3 },
      fetchMap,
      noRoute,
    );
    assert.deepEqual(calls, [[
      "color:green|label:A|44.99,-93.3",
      `color:red|label:B|${dropoffAddress}`,
    ]]);
    assert.equal(result.image, mapImage);
    assert.match(result.caption, /^Cancellation location \(A\) and drop-off \(B\)/);
  }
});

test("an unusable cancellation location falls back to the pickup address", async () => {
  const { calls, fetchMap } = captureMap();
  const result = await loadTripMap(
    { ...trip, status: "cancelled" },
    { location_lat: 0, location_lng: 0 },
    fetchMap,
    noRoute,
  );
  assert.deepEqual(calls, [[
    `color:green|label:A|${pickupAddress}`,
    `color:red|label:B|${dropoffAddress}`,
  ]]);
  assert.match(result.caption, /^Pickup \(A\) and drop-off \(B\)/);
});

test("completed PDF maps do not substitute a cancellation location", async () => {
  const { calls, fetchMap } = captureMap();
  const result = await loadTripMap(trip, { location_lat: 44.99, location_lng: -93.3 }, fetchMap, noRoute);
  assert.deepEqual(calls, [[
    `color:green|label:A|${pickupAddress}`,
    `color:red|label:B|${dropoffAddress}`,
  ]]);
  assert.match(result.caption, /^Pickup \(A\) and drop-off \(B\)/);
});

test("a failed map fetch retains a clear unavailable result", async () => {
  const result = await loadTripMap(trip, null, async () => null, noRoute);
  assert.equal(result.image, null);
  assert.match(result.unavailableReason, /could not be loaded/i);
});

test("PDF map loading draws the primary calculated driving route between A and B", async () => {
  const encodedRoute = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";
  const routeRequests = [];
  const mapRequests = [];
  const result = await loadTripMap(
    trip,
    null,
    async (data, width, height) => {
      mapRequests.push(data);
      const url = new URL(generateStaticMapUrl(data, width, height, "test-key"));
      assert.deepEqual(url.searchParams.getAll("path"), [
        `color:0x2563ebff|weight:5|enc:${encodedRoute}`,
      ]);
      assert.equal(url.searchParams.getAll("markers").length, 2);
      return mapImage;
    },
    async (data) => {
      routeRequests.push(data);
      assert.equal(data.pickupAddress, pickupAddress);
      assert.equal(data.dropoffAddress, dropoffAddress);
      return encodedRoute;
    },
  );
  assert.equal(routeRequests.length, 1);
  assert.equal(mapRequests.length, 1);
  assert.equal(mapRequests[0].primaryRoutePolyline, encodedRoute);
  assert.equal(result.image, mapImage);
  assert.match(result.caption, /Calculated driving route/i);
  assert.equal(result.unavailableReason, null);
});

test("PDF map loading retains endpoint markers and discloses an unavailable driving route", async () => {
  let mapRequested = false;
  const result = await loadTripMap(
    trip,
    null,
    async (data, width, height) => {
      mapRequested = true;
      const url = new URL(generateStaticMapUrl(data, width, height, "test-key"));
      assert.deepEqual(url.searchParams.getAll("path"), []);
      assert.deepEqual(url.searchParams.getAll("markers"), [
        `color:green|label:A|${pickupAddress}`,
        `color:red|label:B|${dropoffAddress}`,
      ]);
      return mapImage;
    },
    noRoute,
  );
  assert.equal(mapRequested, true);
  assert.equal(result.image, mapImage);
  assert.match(result.caption, /route.*unavailable/i);
  assert.equal(result.unavailableReason, null);
});
