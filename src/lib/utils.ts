import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhoneNumber(value: string) {
  if (!value) return value;
  const cleaned = value.replace(/[^\d]/g, "");
  // If we have 11 digits and it starts with 1, take the last 10.
  // Otherwise just take up to 10 digits.
  const phoneNumber =
    cleaned.length > 10 && cleaned.startsWith("1")
      ? cleaned.slice(cleaned.length - 10)
      : cleaned.slice(0, 10);
  const phoneNumberLength = phoneNumber.length;

  if (phoneNumberLength < 4) return phoneNumber;

  if (phoneNumberLength < 7) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  }

  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(
    6,
    10,
  )}`;
}
