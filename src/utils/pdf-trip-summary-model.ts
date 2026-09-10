export const SAMPLE_DRIVER_ATTESTATION =
  "Driver Attestation: By checking this attestation, I understand that I am electronically signing that I affirm that the information contained herein is true and accurate and that I provided and completed the above services. In a proceeding, evidence of a record or signature may not be excluded solely because it is in electronic form.";

export const PDF_MILESTONE_DEFINITIONS = [
  { key: "en_route", label: "In Route" },
  { key: "in_pickup_circle", label: "In PU Circle" },
  { key: "loaded", label: "Loaded" },
  { key: "in_dropoff_circle", label: "In DO Circle" },
  { key: "completed", label: "Completed" },
] as const;

export type PdfMilestoneKey =
  (typeof PDF_MILESTONE_DEFINITIONS)[number]["key"];

export interface PdfTripHistoryEvent {
  status: string;
  status_code?: string | null;
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
  trigger_kind?: "manual" | "automatic" | null;
  source_surface?:
    | "trip_list"
    | "trip_detail"
    | "map_view"
    | "web_crm"
    | "system"
    | null;
  client_platform?: "ios" | "android" | "web" | null;
  location_source?:
    | "bg_live"
    | "navigation_sdk"
    | "bg_cache"
    | "browser_geolocation"
    | null;
}

export interface PdfMilestoneRow {
  key: PdfMilestoneKey;
  label: string;
  createdAt: string | null;
  latitude: number | null;
  longitude: number | null;
  /**
   * Retained for the PDF model and its callers even though the sample-aligned
   * four-column table intentionally does not render a provenance column.
   */
  origin: string;
}

const cleanStatus = (value: string) =>
  value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getMilestoneKey = (rawStatus: string): PdfMilestoneKey | null => {
  const status = cleanStatus(rawStatus);

  if (/\bcompleted\b/.test(status)) return "completed";
  if (/drop ?off circle/.test(status)) return "in_dropoff_circle";
  if (/\bloaded\b/.test(status) || /\bin progress\b/.test(status)) {
    return "loaded";
  }
  // A manual "arrived" transition is not proof that the vehicle entered the
  // geofence. Only an explicit circle event can populate the sample's circle row.
  if (/pick ?up circle/.test(status)) {
    return "in_pickup_circle";
  }
  if (/\ben route\b/.test(status) || /\bin route\b/.test(status)) {
    return "en_route";
  }

  return null;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const normalizeCoordinatePair = (
  latitude: unknown,
  longitude: unknown,
): { latitude: number | null; longitude: number | null } => {
  const validLatitude =
    isFiniteNumber(latitude) && latitude >= -90 && latitude <= 90;
  const validLongitude =
    isFiniteNumber(longitude) && longitude >= -180 && longitude <= 180;

  if (latitude === 0 && longitude === 0) {
    return { latitude: null, longitude: null };
  }

  return {
    latitude: validLatitude ? latitude : null,
    longitude: validLongitude ? longitude : null,
  };
};

export const formatPdfCoordinate = (value: number | null) =>
  value === null ? "Not recorded" : value.toFixed(6);

export const formatPdfEventOrigin = (event: PdfTripHistoryEvent) => {
  if (
    !event.trigger_kind &&
    !event.source_surface &&
    !event.client_platform &&
    !event.location_source
  ) {
    return "Legacy / unknown";
  }

  const trigger =
    event.trigger_kind === "automatic"
      ? "Auto"
      : event.trigger_kind === "manual"
        ? "Manual"
        : "Unknown";
  const surfaceLabels: Record<
    NonNullable<PdfTripHistoryEvent["source_surface"]>,
    string
  > = {
    trip_list: "Trip list",
    trip_detail: "Trip detail",
    map_view: "Map",
    web_crm: "Web CRM",
    system: "System",
  };
  const surface = event.source_surface
    ? surfaceLabels[event.source_surface]
    : "Unknown";
  const platformLabels: Record<
    NonNullable<PdfTripHistoryEvent["client_platform"]>,
    string
  > = {
    ios: "iOS",
    android: "Android",
    web: "Web",
  };
  const platform = event.client_platform
    ? platformLabels[event.client_platform]
    : "Unknown";
  const locationSourceLabels: Record<
    NonNullable<PdfTripHistoryEvent["location_source"]>,
    string
  > = {
    bg_live: "Live GPS",
    navigation_sdk: "Navigation SDK",
    bg_cache: "Cached GPS",
    browser_geolocation: "Browser geolocation",
  };
  const locationSource = event.location_source
    ? locationSourceLabels[event.location_source]
    : null;

  return [trigger, surface, platform, locationSource]
    .filter(Boolean)
    .join(" / ");
};

/**
 * Produces the sample's fixed five-row timeline. Events are selected by their
 * earliest recorded occurrence and absent evidence remains explicitly absent.
 */
export const buildFixedPdfMilestoneRows = (
  history: readonly PdfTripHistoryEvent[],
): PdfMilestoneRow[] => {
  const sortedHistory = [...history].sort((left, right) => {
    const leftTime = Date.parse(left.created_at);
    const rightTime = Date.parse(right.created_at);
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
      return leftTime - rightTime;
    }
    if (Number.isFinite(leftTime)) return -1;
    if (Number.isFinite(rightTime)) return 1;
    return left.created_at.localeCompare(right.created_at);
  });
  const firstByKey = new Map<PdfMilestoneKey, PdfTripHistoryEvent>();

  for (const event of sortedHistory) {
    const key = getMilestoneKey(event.status_code || event.status);
    if (key && !firstByKey.has(key)) firstByKey.set(key, event);
  }

  return PDF_MILESTONE_DEFINITIONS.map(({ key, label }) => {
    const event = firstByKey.get(key);
    if (!event) {
      return {
        key,
        label,
        createdAt: null,
        latitude: null,
        longitude: null,
        origin: "Not recorded",
      };
    }

    const coordinates = normalizeCoordinatePair(
      event.latitude,
      event.longitude,
    );
    return {
      key,
      label,
      createdAt: event.created_at,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      origin: formatPdfEventOrigin(event),
    };
  });
};
