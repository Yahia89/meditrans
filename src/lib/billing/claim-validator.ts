/**
 * Claim Validator
 *
 * Pre-submission validation for Medicaid 837P claims.
 * Ensures all required data is present before generating 837P file.
 */

export interface ValidationError {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ClaimValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface TripForValidation {
  id: string;
  patient_id: string;
  driver_id: string | null;
  pickup_location: string;
  dropoff_location: string;
  scheduled_date: string;
  actual_distance_miles: number | null;
  status: string;
  vehicle_type?: string;
  patient?: {
    full_name: string;
    medicaid_id: string | null;
    diagnosis_code?: string;
  };
  driver?: {
    full_name: string;
    umpi: string | null;
    npi: string | null;
  };
  service_agreement_number?: string;
}

export interface OrganizationForValidation {
  id: string;
  name: string;
  npi: string | null;
  tax_id: string | null;
  billing_state: string | null;
  billing_enabled: boolean;
}

/**
 * Validate organization billing setup
 */
export function validateOrganization(
  org: OrganizationForValidation,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!org.billing_enabled) {
    errors.push({
      field: "billing_enabled",
      message: "Medicaid billing is not enabled",
      severity: "error",
    });
  }

  if (!org.billing_state || !["MN", "CA"].includes(org.billing_state)) {
    errors.push({
      field: "billing_state",
      message: "Organization billing state must be MN or CA",
      severity: "error",
    });
  }

  if (!org.npi || org.npi.length !== 10 || !/^\d+$/.test(org.npi)) {
    errors.push({
      field: "npi",
      message: "Organization NPI must be 10 digits",
      severity: "error",
    });
  }

  if (!org.tax_id || org.tax_id.length < 9) {
    errors.push({
      field: "tax_id",
      message: "Organization Tax ID is required",
      severity: "error",
    });
  }

  return errors;
}

/**
 * Validate a single trip for billing eligibility
 */
export function validateTrip(
  trip: TripForValidation,
  org: OrganizationForValidation,
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check trip status
  if (trip.status !== "completed") {
    errors.push({
      field: "status",
      message: `Trip is not completed (status: ${trip.status})`,
      severity: "error",
    });
  }

  // Check patient Medicaid ID
  if (!trip.patient?.medicaid_id) {
    errors.push({
      field: "medicaid_id",
      message: `Patient ${
        trip.patient?.full_name || trip.patient_id
      } is missing Medicaid ID`,
      severity: "error",
    });
  }

  // Check driver credentials based on state
  if (!trip.driver_id) {
    errors.push({
      field: "driver_id",
      message: `Trip has no driver assigned`,
      severity: "warning",
    });
  } else {
    if (org.billing_state === "MN" && !trip.driver?.umpi) {
      errors.push({
        field: "umpi",
        message: `Driver ${
          trip.driver?.full_name || trip.driver_id
        } is missing UMPI (Required for MN)`,
        severity: "error",
      });
    } else if (org.billing_state === "CA" && !trip.driver?.npi) {
      errors.push({
        field: "npi",
        message: `Driver ${
          trip.driver?.full_name || trip.driver_id
        } is missing NPI (Required for CA)`,
        severity: "error",
      });
    }
  }

  // Check Service Agreement for MN
  if (org.billing_state === "MN" && !trip.service_agreement_number) {
    errors.push({
      field: "service_agreement_number",
      message: "Missing Service Agreement (SA) number for MN waiver claim",
      severity: "error",
    });
  }

  // Check mileage
  if (!trip.actual_distance_miles || trip.actual_distance_miles <= 0) {
    errors.push({
      field: "actual_distance_miles",
      message: `Trip has no recorded mileage`,
      severity: "error",
    });
  }

  // Check addresses
  if (!trip.pickup_location || trip.pickup_location.trim() === "") {
    errors.push({
      field: "pickup_location",
      message: `Trip is missing pickup location`,
      severity: "error",
    });
  }

  if (!trip.dropoff_location || trip.dropoff_location.trim() === "") {
    errors.push({
      field: "dropoff_location",
      message: `Trip is missing dropoff location`,
      severity: "error",
    });
  }

  return errors;
}

/**
 * Validate multiple trips for a claim
 */
export function validateTripsForClaim(
  trips: TripForValidation[],
  org: OrganizationForValidation,
): ClaimValidationResult {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationError[] = [];

  // Validate organization first
  const orgErrors = validateOrganization(org);
  allErrors.push(...orgErrors.filter((e) => e.severity === "error"));
  allWarnings.push(...orgErrors.filter((e) => e.severity === "warning"));

  // Validate each trip
  trips.forEach((trip) => {
    const tripErrors = validateTrip(trip, org);
    allErrors.push(...tripErrors.filter((e) => e.severity === "error"));
    allWarnings.push(...tripErrors.filter((e) => e.severity === "warning"));
  });

  // Check for duplicate trips
  const tripIds = new Set<string>();
  trips.forEach((trip) => {
    if (tripIds.has(trip.id)) {
      allErrors.push({
        field: "trip_id",
        message: `Duplicate trip ID: ${trip.id}`,
        severity: "error",
      });
    }
    tripIds.add(trip.id);
  });

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

/**
 * Check if trip has already been billed
 * This should query the database to prevent duplicate billing
 */
export async function checkDuplicateBilling(
  tripId: string,
  supabase: any,
): Promise<boolean> {
  const { data } = await supabase
    .from("billing_claim_lines")
    .select("id")
    .eq("trip_id", tripId)
    .eq("status", "included")
    .single();

  return !!data;
}
