/**
 * HCPCS Code Definitions for NEMT Medicaid Billing
 *
 * Minnesota-specific codes based on DHS fee schedule.
 * Source: https://www.dhs.state.mn.us/main/idcplg?IdcService=GET_DYNAMIC_CONVERSION&RevisionSelectionMethod=LatestReleased&dDocName=ID_016391
 */

export type VehicleType =
  | "wheelchair_van"
  | "protected_transport"
  | "stretcher"
  | "sedan"
  | "ambulatory";

export interface HCPCSCode {
  code: string;
  description: string;
  type: "base" | "mileage" | "attendant" | "wait_time";
  vehicleType: VehicleType;
  stateSpecific?: string[];
}

/**
 * Minnesota NEMT HCPCS Codes
 */
export const MN_HCPCS_CODES: Record<string, HCPCSCode> = {
  // Wheelchair Van
  A0130: {
    code: "A0130",
    description: "Wheelchair van, base rate (with ramp/lift)",
    type: "base",
    vehicleType: "wheelchair_van",
    stateSpecific: ["MN"],
  },
  S0209: {
    code: "S0209",
    description: "Wheelchair van, mileage (per mile)",
    type: "mileage",
    vehicleType: "wheelchair_van",
    stateSpecific: ["MN"],
  },

  // Protected Transport
  T2003: {
    code: "T2003",
    description: "Protected transport, base rate",
    type: "base",
    vehicleType: "protected_transport",
    stateSpecific: ["MN"],
  },
  S0215: {
    code: "S0215",
    description: "Protected transport, mileage (per mile)",
    type: "mileage",
    vehicleType: "protected_transport",
    stateSpecific: ["MN"],
  },

  // Stretcher
  T2005: {
    code: "T2005",
    description: "Stretcher van, base rate",
    type: "base",
    vehicleType: "stretcher",
    stateSpecific: ["MN"],
  },
  T2049: {
    code: "T2049",
    description: "Stretcher van, mileage (per mile)",
    type: "mileage",
    vehicleType: "stretcher",
    stateSpecific: ["MN"],
  },

  // Sedan/Ambulatory (Regular car service)
  A0100: {
    code: "A0100",
    description: "Non-emergency transport, taxi, sedan",
    type: "base",
    vehicleType: "sedan",
    stateSpecific: ["MN"],
  },
  A0110: {
    code: "A0110",
    description: "Non-emergency transport, mileage (per mile)",
    type: "mileage",
    vehicleType: "sedan",
    stateSpecific: ["MN"],
  },

  // Extra Attendant
  T2001: {
    code: "T2001",
    description: "Extra attendant",
    type: "attendant",
    vehicleType: "sedan", // Can be used with any vehicle
  },
};

/**
 * California (Medi-Cal) NEMT HCPCS Codes
 */
export const CA_HCPCS_CODES: Record<string, HCPCSCode> = {
  // Wheelchair Van
  A0130: {
    code: "A0130",
    description: "Wheelchair van (with ramp/lift)",
    type: "base",
    vehicleType: "wheelchair_van",
    stateSpecific: ["CA"],
  },
  A0170: {
    code: "A0170",
    description: "Non-emergency transport, mileage (per mile)",
    type: "mileage",
    vehicleType: "wheelchair_van",
    stateSpecific: ["CA"],
  },

  // Sedan/Ambulatory
  A0100: {
    code: "A0100",
    description: "Non-emergency transport, sedan",
    type: "base",
    vehicleType: "sedan",
    stateSpecific: ["CA"],
  },
  A0170_SEDAN: {
    code: "A0170",
    description: "Non-emergency transport, mileage (per mile)",
    type: "mileage",
    vehicleType: "sedan",
    stateSpecific: ["CA"],
  },

  // Stretcher
  A0392: {
    code: "A0392",
    description: "Advanced life support, level 2 (ALS 2)",
    type: "base",
    vehicleType: "stretcher",
    stateSpecific: ["CA"],
  },
  A0425: {
    code: "A0425",
    description: "Ground mileage, per statute mile",
    type: "mileage",
    vehicleType: "stretcher",
    stateSpecific: ["CA"],
  },

  // Wait Time
  A0420: {
    code: "A0420",
    description: "Ambulance wait time, per half hour",
    type: "wait_time",
    vehicleType: "sedan",
    stateSpecific: ["CA"],
  },
};

/**
 * Minnesota Origin/Destination Modifiers
 * Required for NEMT billing
 */
export const MN_ORIGIN_DEST_MODIFIERS: Record<string, string> = {
  R: "Residence",
  H: "Hospital",
  P: "Physician Office",
  N: "Nursing Facility",
  D: "Diagnostic/Therapeutic Site",
  S: "Scene of Accident",
  X: "Intermediate Stop",
};

/**
 * Get HCPCS codes for a vehicle type and state
 */
export function getHCPCSCodes(
  state: "MN" | "CA",
  vehicleType: VehicleType
): {
  base: HCPCSCode;
  mileage: HCPCSCode;
} {
  const codesMap = state === "CA" ? CA_HCPCS_CODES : MN_HCPCS_CODES;
  const codes = Object.values(codesMap);

  const base = codes.find(
    (c) => c.vehicleType === vehicleType && c.type === "base"
  );
  const mileage = codes.find(
    (c) => c.vehicleType === vehicleType && c.type === "mileage"
  );

  if (!base || !mileage) {
    // Fallback to sedan if specific vehicle type not found
    const sedanBase = codes.find(
      (c) => c.vehicleType === "sedan" && c.type === "base"
    );
    const sedanMileage = codes.find(
      (c) => c.vehicleType === "sedan" && c.type === "mileage"
    );
    if (!sedanBase || !sedanMileage) {
      throw new Error(
        `No HCPCS codes found for state ${state} and vehicle type ${vehicleType}`
      );
    }
    return { base: sedanBase, mileage: sedanMileage };
  }

  return { base, mileage };
}

/**
 * Get HCPCS codes for a vehicle type (Legacy/MN only)
 */
export function getCodesForVehicleType(vehicleType: VehicleType): {
  base: HCPCSCode;
  mileage: HCPCSCode;
} {
  const codes = Object.values(MN_HCPCS_CODES);

  const base = codes.find(
    (c) => c.vehicleType === vehicleType && c.type === "base"
  );
  const mileage = codes.find(
    (c) => c.vehicleType === vehicleType && c.type === "mileage"
  );

  if (!base || !mileage) {
    throw new Error(`No HCPCS codes found for vehicle type: ${vehicleType}`);
  }

  return { base, mileage };
}

/**
 * Determine vehicle type from trip data
 * This should be customized based on your vehicle_type_need field
 */
export function determineVehicleType(
  vehicleTypeNeed?: string | null
): VehicleType {
  if (!vehicleTypeNeed) return "sedan";

  const normalized = vehicleTypeNeed.toLowerCase();

  if (normalized.includes("wheelchair")) return "wheelchair_van";
  if (normalized.includes("stretcher")) return "stretcher";
  if (normalized.includes("protected")) return "protected_transport";
  if (normalized.includes("ambulatory")) return "ambulatory";
  if (normalized.includes("sedan")) return "sedan";

  return "sedan";
}

/**
 * Calculate mileage charge
 * Minnesota requires actual loaded miles, rounded to nearest whole mile
 */
export function calculateMileageCharge(
  miles: number,
  ratePerMile: number
): {
  roundedMiles: number;
  charge: number;
} {
  // Minnesota rounding: 0.5+ rounds up, <0.5 rounds down
  const roundedMiles = Math.round(miles);
  const charge = roundedMiles * ratePerMile;

  return { roundedMiles, charge };
}

/**
 * Default reimbursement rates (example - should be fetched from database)
 */
export const DEFAULT_RATES: Record<string, number> = {
  // Base rates
  A0130: 25.0, // Wheelchair van base
  T2003: 20.0, // Protected transport base
  T2005: 30.0, // Stretcher base

  // Mileage rates
  S0209: 2.5, // Wheelchair mileage
  S0215: 2.0, // Protected mileage
  T2049: 3.0, // Stretcher mileage

  // Other
  T2001: 15.0, // Extra attendant
};
