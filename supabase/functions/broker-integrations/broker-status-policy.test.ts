import { planBrokerLocalStatus } from "./broker-status-policy.ts";

function assertEquals(actual: unknown, expected: unknown) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, received ${actualJson}`);
  }
}

function assertNoStatusMutation(patch: { readonly status?: never }) {
  assertEquals(Object.prototype.hasOwnProperty.call(patch, "status"), false);
}

Deno.test("all terminal broker statuses remain external-only", () => {
  for (
    const externalStatus of [
      "complete",
      "completed",
      "trip_completed",
      "cancel",
      "canceled",
      "trip_cancelled",
      "no_show",
      "no show",
    ]
  ) {
    const plan = planBrokerLocalStatus(externalStatus);
    assertEquals(plan.newTripStatus, "pending");
    assertNoStatusMutation(plan.existingTripPatch);
  }
});

Deno.test("non-terminal broker statuses also preserve existing local workflow", () => {
  for (const externalStatus of ["pending", "assigned", "dropped", undefined]) {
    const plan = planBrokerLocalStatus(externalStatus);
    assertEquals(plan.newTripStatus, "pending");
    assertNoStatusMutation(plan.existingTripPatch);
  }
});
