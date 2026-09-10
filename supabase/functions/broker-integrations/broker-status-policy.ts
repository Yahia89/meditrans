export interface BrokerLocalStatusPlan {
  newTripStatus: "pending";
  existingTripPatch: { readonly status?: never };
}

/**
 * Broker status is external evidence, not authority over the local driver
 * workflow. Completion, cancellation, and no-show all require the local
 * transition contract's audit, idempotency, and provenance guarantees.
 *
 * The verbatim broker value is stored by the caller in external_status and the
 * broker audit/link records. Newly discovered trips enter local review as
 * pending, while existing local status is never mutated by broker sync.
 */
export function planBrokerLocalStatus(
  externalStatus?: string,
): BrokerLocalStatusPlan {
  // Keep the external value in the API so every broker status follows the same
  // explicit policy, while deliberately granting it no local workflow authority.
  void externalStatus;
  return {
    newTripStatus: "pending",
    existingTripPatch: {},
  };
}
