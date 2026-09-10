export const MAX_BROWSER_EVENT_LOCATION_AGE_MS = 60_000;
export const MAX_BROWSER_EVENT_LOCATION_FUTURE_SKEW_MS = 15_000;
export const MAX_BROWSER_EVENT_LOCATION_ACCURACY_METERS = 60;

export type BrowserEventLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: string;
};

type BrowserPositionEvidence = {
  latitude: unknown;
  longitude: unknown;
  accuracyMeters: unknown;
  capturedAtMs: unknown;
};

export function normalizeBrowserEventLocation(
  evidence: BrowserPositionEvidence,
  nowMs: number = Date.now(),
): BrowserEventLocation {
  const { latitude, longitude, accuracyMeters, capturedAtMs } = evidence;

  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    (latitude === 0 && longitude === 0)
  ) {
    throw new Error("The browser returned invalid coordinates.");
  }

  if (
    typeof capturedAtMs !== "number" ||
    !Number.isFinite(capturedAtMs) ||
    !Number.isFinite(nowMs)
  ) {
    throw new Error("The browser returned an invalid location timestamp.");
  }

  const ageMs = nowMs - capturedAtMs;
  if (
    ageMs < -MAX_BROWSER_EVENT_LOCATION_FUTURE_SKEW_MS ||
    ageMs > MAX_BROWSER_EVENT_LOCATION_AGE_MS
  ) {
    throw new Error(
      "The browser location is too old or its timestamp is too far in the future.",
    );
  }

  if (
    typeof accuracyMeters !== "number" ||
    !Number.isFinite(accuracyMeters) ||
    accuracyMeters < 0 ||
    accuracyMeters > MAX_BROWSER_EVENT_LOCATION_ACCURACY_METERS
  ) {
    throw new Error(
      `The browser location must be accurate to ${MAX_BROWSER_EVENT_LOCATION_ACCURACY_METERS} meters or better.`,
    );
  }

  return {
    latitude,
    longitude,
    accuracyMeters,
    capturedAt: new Date(capturedAtMs).toISOString(),
  };
}
