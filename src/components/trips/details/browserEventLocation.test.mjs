import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_BROWSER_EVENT_LOCATION_AGE_MS,
  MAX_BROWSER_EVENT_LOCATION_ACCURACY_METERS,
  MAX_BROWSER_EVENT_LOCATION_FUTURE_SKEW_MS,
  normalizeBrowserEventLocation,
} from "./browserEventLocation.ts";

const nowMs = Date.parse("2026-08-31T12:00:00.000Z");

const validEvidence = {
  latitude: 44.9778,
  longitude: -93.265,
  accuracyMeters: 12,
  capturedAtMs: nowMs,
};

test("accepts boundary-fresh, 60-meter evidence and a valid zero coordinate", () => {
  const normalized = normalizeBrowserEventLocation(
    {
      ...validEvidence,
      latitude: 0,
      accuracyMeters: MAX_BROWSER_EVENT_LOCATION_ACCURACY_METERS,
      capturedAtMs: nowMs - MAX_BROWSER_EVENT_LOCATION_AGE_MS,
    },
    nowMs,
  );

  assert.equal(normalized.latitude, 0);
  assert.equal(normalized.longitude, validEvidence.longitude);
  assert.equal(normalized.accuracyMeters, 60);
  assert.equal(normalized.capturedAt, "2026-08-31T11:59:00.000Z");
});

test("accepts the configured future clock-skew boundary", () => {
  assert.doesNotThrow(() =>
    normalizeBrowserEventLocation(
      {
        ...validEvidence,
        capturedAtMs: nowMs + MAX_BROWSER_EVENT_LOCATION_FUTURE_SKEW_MS,
      },
      nowMs,
    ),
  );
});

test("rejects stale and excessively future-dated evidence", () => {
  assert.throws(() =>
    normalizeBrowserEventLocation(
      {
        ...validEvidence,
        capturedAtMs: nowMs - MAX_BROWSER_EVENT_LOCATION_AGE_MS - 1,
      },
      nowMs,
    ),
  );
  assert.throws(() =>
    normalizeBrowserEventLocation(
      {
        ...validEvidence,
        capturedAtMs: nowMs + MAX_BROWSER_EVENT_LOCATION_FUTURE_SKEW_MS + 1,
      },
      nowMs,
    ),
  );
});

test("rejects missing, non-finite, and worse-than-60-meter accuracy", () => {
  for (const accuracyMeters of [undefined, Number.NaN, Number.POSITIVE_INFINITY, -1, 60.01]) {
    assert.throws(() =>
      normalizeBrowserEventLocation(
        { ...validEvidence, accuracyMeters },
        nowMs,
      ),
    );
  }
});

test("rejects null-island and out-of-range coordinates", () => {
  for (const coordinates of [
    { latitude: 0, longitude: 0 },
    { latitude: 91, longitude: -93 },
    { latitude: 45, longitude: -181 },
  ]) {
    assert.throws(() =>
      normalizeBrowserEventLocation(
        { ...validEvidence, ...coordinates },
        nowMs,
      ),
    );
  }
});
