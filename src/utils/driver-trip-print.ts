import { fromZonedTime } from "date-fns-tz";
import { formatInUserTimezone } from "../lib/timezone.ts";

export interface DriverTripDateRange {
  startDate: string;
  endDate: string;
}

export const ALL_DRIVER_TRIP_DATES: Readonly<DriverTripDateRange> = { startDate: "", endDate: "" };

export interface DriverPrintTrip {
  id: string;
  org_id: string;
  driver_id: string | null;
  patient_id: string | null;
  pickup_time: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
  status: string | null;
  broker_trip_id: string | null;
  broker_reference_number: string | null;
  actual_distance_miles: number | null;
  distance_miles: number | null;
  patient: { id: string; org_id: string; full_name: string | null } | null;
}

export function getDriverTripDateBounds(range: DriverTripDateRange, timezone: string) {
  for (const value of [range.startDate, range.endDate]) {
    if (!value) continue;
    const date = new Date(`${value}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.getUTCFullYear() < 1 || date.toISOString().slice(0, 10) !== value) {
      throw new Error("Enter valid trip pickup dates.");
    }
  }
  if (range.startDate && range.endDate && range.startDate > range.endDate) {
    throw new Error("The trip end date must be on or after the start date.");
  }
  const midnight = (date: string) => {
    const value = fromZonedTime(`${date}T00:00:00`, timezone);
    if (!Number.isFinite(value.getTime())) throw new Error("The report timezone is invalid.");
    return value.toISOString();
  };
  let before: string | undefined;
  if (range.endDate) {
    const nextDate = new Date(`${range.endDate}T00:00:00Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    before = midnight(nextDate.toISOString().slice(0, 10));
  }
  return { from: range.startDate ? midnight(range.startDate) : undefined, before };
}

export function validateDriverPrintTrips(
  scope: { id: string; org_id: string },
  trips: readonly DriverPrintTrip[] | undefined,
) {
  if (!trips) throw new Error("The driver's trip details are unavailable. Try again or deselect Trips and count.");
  const ids = new Set<string>();
  for (const trip of trips) {
    if (trip.org_id !== scope.org_id || trip.driver_id !== scope.id ||
      (trip.patient && (trip.patient.org_id !== scope.org_id || trip.patient.id !== trip.patient_id))) {
      throw new Error("The trip details do not match the selected driver and company.");
    }
    if (!trip.id || ids.has(trip.id)) throw new Error("The trip list changed while loading. Please try again.");
    ids.add(trip.id);
  }
  return trips;
}

export function buildDriverTripPrintData({ driver, trips, range = ALL_DRIVER_TRIP_DATES, timezone }: {
  driver: { id: string; org_id: string };
  trips: readonly DriverPrintTrip[] | undefined;
  range?: DriverTripDateRange;
  timezone: string;
}) {
  const records = validateDriverPrintTrips(driver, trips);
  const bounds = getDriverTripDateBounds(range, timezone);
  for (const trip of records) {
    const time = trip.pickup_time ? new Date(trip.pickup_time).getTime() : NaN;
    if ((bounds.from || bounds.before) && (!Number.isFinite(time) ||
      (bounds.from && time < new Date(bounds.from).getTime()) ||
      (bounds.before && time >= new Date(bounds.before).getTime()))) {
      throw new Error("The trip details do not match the selected pickup dates.");
    }
  }
  const dateLabel = (date: string) => formatInUserTimezone(date, "UTC", "MMM d, yyyy");
  const period = range.startDate && range.endDate ? `${dateLabel(range.startDate)} - ${dateLabel(range.endDate)}`
    : range.startDate ? `From ${dateLabel(range.startDate)}`
      : range.endDate ? `Through ${dateLabel(range.endDate)}` : "All dates";
  const summaryRows: [string, string][] = [
    ["Pickup dates", period],
    ["Time zone", timezone],
    ["Total assigned trips (all statuses)", String(records.length)],
  ];
  if (!records.length) summaryRows.push(["Trip details", "No assigned trips found for the selected pickup dates."]);
  const text = (value: string | null) => value?.trim() || "Not recorded";
  const miles = (value: number | null) => typeof value === "number" && Number.isFinite(value) && value >= 0
    ? `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} mi` : null;
  const detailRows = [...records]
    .sort((a, b) => (b.pickup_time || "").localeCompare(a.pickup_time || "") || a.id.localeCompare(b.id))
    .map((trip) => {
      const scheduled = trip.pickup_time ? formatInUserTimezone(trip.pickup_time, timezone, "MMM d, yyyy h:mm a") : "Not recorded";
      const actual = miles(trip.actual_distance_miles);
      const estimated = miles(trip.distance_miles);
      return [
        [scheduled, `Trip ID: ${trip.id}`, trip.broker_trip_id && `Broker trip: ${trip.broker_trip_id}`, trip.broker_reference_number && `Reference: ${trip.broker_reference_number}`].filter(Boolean).join("\n"),
        [`Passenger: ${trip.patient?.full_name?.trim() || "Unavailable"}`, `Pickup: ${text(trip.pickup_location)}`, `Dropoff: ${text(trip.dropoff_location)}`].join("\n"),
        [`Status: ${text(trip.status).replace(/_/g, " ")}`, actual && `Recorded: ${actual}`, estimated && `Estimated: ${estimated}`, !actual && !estimated && "Mileage not recorded"].filter(Boolean).join("\n"),
      ];
    });
  return { summaryRows, detailRows };
}
