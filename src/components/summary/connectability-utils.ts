/**
 * ConnectAbility referral normalization utilities.
 *
 * ConnectAbility clients appear in the DB under several naming variations:
 *   - "ConnectAbilityMN"
 *   - "ConnectAbility OF MN"
 *   - "ConnectAbility of MN"
 *   - "ConnectAbility"
 *   - etc.
 *
 * All of these map to the canonical label: "ConnectAbility of MN"
 */

export const CONNECTABILITY_CANONICAL = "ConnectAbility of MN";

/**
 * Returns true if the given referral_by string is any variant of ConnectAbility.
 */
export function isConnectAbilityReferrer(referredBy: string | null | undefined): boolean {
  if (!referredBy) return false;
  return /connectability/i.test(referredBy);
}

/**
 * Normalizes a referral_by value.
 * Any ConnectAbility variant is replaced with the canonical label.
 * All other values are returned unchanged.
 */
export function normalizeReferredBy(referredBy: string | null | undefined): string | null {
  if (!referredBy) return referredBy ?? null;
  if (isConnectAbilityReferrer(referredBy)) return CONNECTABILITY_CANONICAL;
  return referredBy;
}

/**
 * Returns true if ALL of the provided selectedReferredBy filter values
 * are ConnectAbility variants (i.e. the report is exclusively for ConnectAbility).
 */
export function isConnectAbilityOnlyFilter(selectedReferredBy: string[]): boolean {
  if (selectedReferredBy.length === 0) return false;
  return selectedReferredBy.every((r) => isConnectAbilityReferrer(r));
}
