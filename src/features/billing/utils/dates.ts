import { formatInTimeZone } from "date-fns-tz";

export function formatBillingTimestamp(value: string | null | undefined, timezone: string): string {
  if (!value) return "Not recorded";
  return formatInTimeZone(value, timezone, "MMM d, yyyy · h:mm a zzz");
}

/** Calendar dates retain their date-only precision and never shift timezones. */
export function formatBillingDate(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  return formatInTimeZone(`${value}T12:00:00Z`, "UTC", "MMM d, yyyy");
}
