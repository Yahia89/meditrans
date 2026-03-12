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

export const STATE_TIMEZONE_MAP: Record<string, string> = {
  // Eastern Time
  CT: "America/New_York",
  DE: "America/New_York",
  DC: "America/New_York",
  FL: "America/New_York",
  GA: "America/New_York",
  IN: "America/New_York",
  KY: "America/New_York",
  ME: "America/New_York",
  MD: "America/New_York",
  MA: "America/New_York",
  MI: "America/New_York",
  NH: "America/New_York",
  NJ: "America/New_York",
  NY: "America/New_York",
  NC: "America/New_York",
  OH: "America/New_York",
  PA: "America/New_York",
  RI: "America/New_York",
  SC: "America/New_York",
  VT: "America/New_York",
  VA: "America/New_York",
  WV: "America/New_York",
  // Central Time
  AL: "America/Chicago",
  AR: "America/Chicago",
  IL: "America/Chicago",
  IA: "America/Chicago",
  KS: "America/Chicago",
  LA: "America/Chicago",
  MN: "America/Chicago",
  MS: "America/Chicago",
  MO: "America/Chicago",
  NE: "America/Chicago",
  ND: "America/Chicago",
  OK: "America/Chicago",
  SD: "America/Chicago",
  TN: "America/Chicago",
  TX: "America/Chicago",
  WI: "America/Chicago",
  // Mountain Time
  AZ: "America/Phoenix",
  CO: "America/Denver",
  ID: "America/Denver",
  MT: "America/Denver",
  NM: "America/Denver",
  UT: "America/Denver",
  WY: "America/Denver",
  // Pacific Time
  CA: "America/Los_Angeles",
  NV: "America/Los_Angeles",
  OR: "America/Los_Angeles",
  WA: "America/Los_Angeles",
  // Others
  AK: "America/Anchorage",
  HI: "Pacific/Honolulu",
};

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
