import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";
import { format } from "date-fns";

export const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Phoenix", label: "Mountain Time (no DST)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
];

/**
 * Gets the active timezone for the user.
 * Order of precedence:
 * 1. User's personal preference (profile.timezone)
 * 2. Organization's default timezone (organization.timezone)
 * 3. Fallback to 'America/Chicago' (Central Time)
 */
export function getActiveTimezone(
  userProfile: { timezone?: string | null } | null,
  organization: { timezone?: string | null } | null,
): string {
  return userProfile?.timezone || organization?.timezone || "America/Chicago";
}

/**
 * Formats a date string or object into a human-readable string in the specified timezone.
 */
export function formatInUserTimezone(
  date: string | Date | number,
  timezone: string,
  formatStr: string = "MMM d, yyyy h:mm a",
): string {
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    // Check if date is valid
    if (isNaN(new Date(d).getTime())) return "Invalid Date";
    return formatInTimeZone(d, timezone, formatStr);
  } catch (e) {
    console.error("Error formatting date in timezone:", e);
    return format(date, formatStr);
  }
}

/**
 * Converts a date to a zoned time object.
 */
export function getZonedTime(
  date: string | Date | number,
  timezone: string,
): Date {
  const d = typeof date === "string" ? new Date(date) : date;
  return toZonedTime(d, timezone);
}

/**
 * Parses a date and time string in a specific timezone and returns a UTC Date object.
 */
export function parseZonedTime(
  dateStr: string, // "yyyy-MM-dd"
  timeStr: string, // "HH:mm"
  timezone: string,
): Date {
  return fromZonedTime(`${dateStr} ${timeStr}`, timezone);
}

/**
 * Returns a human-readable label for a timezone value.
 */
export function getTimezoneLabel(value: string): string {
  if (!value) return "";
  const found = US_TIMEZONES.find((tz) => tz.value === value);
  return found?.label || value;
}
