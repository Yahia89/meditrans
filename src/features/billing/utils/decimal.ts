/**
 * Exact Decimal Arithmetic Utility for Financial and Billing Computations.
 * Avoids IEEE 754 floating-point inaccuracies (e.g., 0.1 + 0.2 !== 0.3 or 80 * 1.54).
 * Uses scaled integer arithmetic with explicit rounding to cents (2 decimal places).
 */

/**
 * Normalizes input string or number to clean decimal representation.
 */
function cleanDecimalString(val: string | number): string {
  if (typeof val === "number") {
    if (!Number.isFinite(val)) return "0.00";
    return val.toFixed(4);
  }
  const cleaned = val.trim().replace(/[$,]/g, "");
  return cleaned === "" || isNaN(Number(cleaned)) ? "0.00" : cleaned;
}

/**
 * Parse a decimal string into a scaled integer (micro-units: 10^4 scale for rates and quantities).
 */
function parseToScaled(val: string | number, scale: number = 4): bigint {
  const str = cleanDecimalString(val);
  const isNegative = str.startsWith("-");
  const absStr = isNegative ? str.slice(1) : str;
  const parts = absStr.split(".");
  const intPart = parts[0] || "0";
  let fracPart = parts[1] || "";

  if (fracPart.length < scale) {
    fracPart = fracPart.padEnd(scale, "0");
  } else if (fracPart.length > scale) {
    // Round to scale
    const extra = fracPart.slice(scale);
    fracPart = fracPart.slice(0, scale);
    if (Number(extra[0]) >= 5) {
      const bumped = (BigInt(intPart + fracPart) + 1n).toString();
      return isNegative ? -BigInt(bumped) : BigInt(bumped);
    }
  }

  const result = BigInt(intPart + fracPart);
  return isNegative ? -result : result;
}

/**
 * Converts any monetary amount to integer cents (10^2).
 */
export function toCents(val: string | number): bigint {
  const scaled = parseToScaled(val, 2);
  return scaled;
}

/**
 * Formats integer cents back to a fixed 2-decimal money string (e.g., "123.20").
 */
export function fromCents(cents: bigint): string {
  const isNegative = cents < 0n;
  const absCents = isNegative ? -cents : cents;
  const str = absCents.toString().padStart(3, "0");
  const intPart = str.slice(0, -2);
  const fracPart = str.slice(-2);
  return `${isNegative ? "-" : ""}${intPart}.${fracPart}`;
}

/**
 * Safely format monetary value as USD display string (e.g. "$123.20" or "-$50.00").
 */
export function formatMoney(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "$0.00";
  const cents = toCents(val);
  const formatted = fromCents(cents);
  const isNegative = formatted.startsWith("-");
  const absValue = isNegative ? formatted.slice(1) : formatted;
  const parts = absValue.split(".");
  const withCommas = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${isNegative ? "-" : ""}$${withCommas}.${parts[1]}`;
}

/**
 * Adds multiple monetary amounts with exact cent precision.
 */
export function addMoney(...amounts: (string | number | null | undefined)[]): string {
  let totalCents = 0n;
  for (const amt of amounts) {
    if (amt !== null && amt !== undefined) {
      totalCents += toCents(amt);
    }
  }
  return fromCents(totalCents);
}

/**
 * Subtracts subtrahends from minuend with exact cent precision.
 */
export function subtractMoney(
  minuend: string | number | null | undefined,
  ...subtrahends: (string | number | null | undefined)[]
): string {
  let balanceCents = toCents(minuend ?? 0);
  for (const sub of subtrahends) {
    if (sub !== null && sub !== undefined) {
      balanceCents -= toCents(sub);
    }
  }
  return fromCents(balanceCents);
}

/**
 * Calculates line billed charge: quantity × rate with half-up rounding to cents.
 * Example: 80 * 1.54 = 123.20 (NOT 124.00)
 */
export function multiplyQtyRate(
  quantity: string | number,
  rate: string | number
): string {
  // Scale each by 10^2 -> product is scaled by 10^4
  const qCents = toCents(quantity);
  const rCents = toCents(rate);
  const product = qCents * rCents; // scaled by 10,000

  // Divide by 100 with half-up rounding to get cents (scaled by 100)
  const remainder = product % 100n;
  let finalCents = product / 100n;
  if (remainder >= 50n || remainder <= -50n) {
    finalCents += product > 0n ? 1n : -1n;
  }
  return fromCents(finalCents);
}

/**
 * Computes posted outstanding balance:
 * current billed charges - confirmed net payments - authorized adjustments
 * Does NOT clamp overpayments to zero.
 */
export function calculateOutstandingBalance(
  billedCharges: string | number,
  netConfirmedPayments: string | number,
  authorizedAdjustments: string | number
): string {
  return subtractMoney(billedCharges, netConfirmedPayments, authorizedAdjustments);
}

/**
 * Compare two monetary values:
 * returns 1 if a > b, -1 if a < b, 0 if a === b
 */
export function compareMoney(a: string | number, b: string | number): number {
  const cA = toCents(a);
  const cB = toCents(b);
  if (cA > cB) return 1;
  if (cA < cB) return -1;
  return 0;
}
