import assert from "node:assert/strict";
import test from "node:test";

import {
  generateStaticMapUrl,
  resolveMapLocation,
} from "./static-map-generator.ts";

const pickupAddress = "111 Pickup Street, Minneapolis, MN";
const dropoffAddress = "222 Drop-off Avenue, Minneapolis, MN";
const mapUrl = (data) =>
  generateStaticMapUrl(data, 600, 600, "test-key");
const markers = (data) => new URL(mapUrl(data)).searchParams.getAll("markers");

test("renders green A and red B markers from addresses when coordinates are absent", () => {
  assert.deepEqual(markers({
    pickupLat: null,
    pickupLng: null,
    dropoffLat: null,
    dropoffLng: null,
    pickupAddress,
    dropoffAddress,
  }), [
    `color:green|label:A|${pickupAddress}`,
    `color:red|label:B|${dropoffAddress}`,
  ]);
});

test("uses each endpoint independently and prefers recorded coordinates over its address", () => {
  assert.deepEqual(markers({
    pickupLat: 44.98,
    pickupLng: -93.27,
    pickupAddress,
    dropoffAddress,
  }), [
    "color:green|label:A|44.98,-93.27",
    `color:red|label:B|${dropoffAddress}`,
  ]);
  assert.deepEqual(markers({
    pickupAddress,
    dropoffLat: 44.95,
    dropoffLng: -93.1,
    dropoffAddress,
  }), [
    `color:green|label:A|${pickupAddress}`,
    "color:red|label:B|44.95,-93.1",
  ]);
});

test("accepts finite numeric strings and individual zero coordinates", () => {
  assert.equal(resolveMapLocation("44.98", " -93.27 ", pickupAddress), "44.98,-93.27");
  assert.equal(resolveMapLocation(0, -78.5, pickupAddress), "0,-78.5");
  assert.equal(resolveMapLocation(51.5, 0, pickupAddress), "51.5,0");
  assert.equal(resolveMapLocation("0", "-78.5"), "0,-78.5");
});

test("falls back to the address for missing, incomplete, or invalid coordinate pairs", () => {
  for (const [latitude, longitude] of [
    [null, null],
    [null, -93.27],
    [44.98, null],
    [undefined, -93.27],
    [44.98, undefined],
    ["", -93.27],
    [44.98, ""],
    ["  ", -93.27],
    [44.98, " \t "],
    [91, -93.27],
    [-91, -93.27],
    [44.98, 181],
    [44.98, -181],
    [NaN, -93.27],
    [44.98, NaN],
    [Infinity, -93.27],
    [44.98, -Infinity],
    ["NaN", -93.27],
    [44.98, "Infinity"],
    [false, -93.27],
    [44.98, true],
    [0, 0],
    ["0", "0"],
  ]) {
    assert.equal(
      resolveMapLocation(latitude, longitude, pickupAddress),
      pickupAddress,
      `unexpected location for ${String(latitude)},${String(longitude)}`,
    );
    assert.equal(resolveMapLocation(latitude, longitude), null);
  }
});

test("refuses to generate an incomplete A-to-B map", () => {
  for (const data of [
    {},
    { pickupAddress },
    { dropoffAddress },
    { pickupLat: 44.98, pickupLng: -93.27, dropoffAddress: " \t " },
    { pickupAddress: "| |", dropoffAddress },
  ]) {
    assert.equal(mapUrl(data), "");
  }
});

test("keeps address punctuation within one marker and removes marker separators", () => {
  const data = {
    pickupAddress: "  A&B Clinic #2 + Pharmacy | 10 Main St\nMinneapolis, MN  ",
    dropoffAddress: "C+D & Sons #5 | 20 Oak St",
  };
  const url = new URL(mapUrl(data));
  assert.equal(url.hash, "");
  assert.deepEqual(url.searchParams.getAll("markers"), [
    "color:green|label:A|A&B Clinic #2 + Pharmacy 10 Main St Minneapolis, MN",
    "color:red|label:B|C+D & Sons #5 20 Oak St",
  ]);
  assert.deepEqual([...new Set(url.searchParams.keys())].sort(), [
    "format", "key", "maptype", "markers", "size",
  ]);
  assert.equal(url.searchParams.get("key"), "test-key");
});

const googleExamplePath = [
  { lat: 38.5, lng: -120.2 },
  { lat: 40.7, lng: -120.95 },
  { lat: 43.252, lng: -126.453 },
];
const googleExampleEncoded = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";

test("preserves encoded planned and deviation paths through query serialization", () => {
  const url = new URL(mapUrl({
    pickupAddress,
    dropoffAddress,
    routePaths: {
      plannedPath: googleExamplePath,
      deviationPaths: [googleExamplePath],
    },
  }));
  assert.deepEqual(url.searchParams.getAll("path"), [
    `color:0x3b82f6ff|weight:4|enc:${googleExampleEncoded}`,
    `color:0xf97316ff|weight:3|enc:${googleExampleEncoded}`,
  ]);
  assert.equal(url.hash, "");
});

test("keeps an actual driven route when there is no planned route", () => {
  const url = new URL(mapUrl({
    pickupAddress,
    dropoffAddress,
    routePaths: { drivenPath: googleExamplePath },
  }));
  assert.deepEqual(url.searchParams.getAll("path"), [
    `color:0x9ca3afff|weight:3|enc:${googleExampleEncoded}`,
  ]);
});

test("draws only the primary driving route when other route paths are present", () => {
  const url = new URL(mapUrl({
    pickupAddress,
    dropoffAddress,
    primaryRoutePolyline: googleExampleEncoded,
    routePaths: {
      plannedPath: googleExamplePath,
      deviationPaths: [googleExamplePath, googleExamplePath],
      drivenPath: googleExamplePath,
    },
  }));
  assert.deepEqual(url.searchParams.getAll("path"), [
    `color:0x2563ebff|weight:5|enc:${googleExampleEncoded}`,
  ]);
  assert.deepEqual(url.searchParams.getAll("markers"), [
    `color:green|label:A|${pickupAddress}`,
    `color:red|label:B|${dropoffAddress}`,
  ]);
});
