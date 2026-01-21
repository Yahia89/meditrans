export const SERVICE_TYPES = [
  "Work",
  "School",
  "Pleasure",
  "Dentist",
  "Medical Appointment",
  "Clinics",
  "Methadone Clinics",
  "Dialysis",
  "Regular Transportation",
  "Other",
] as const;

export const VEHICLE_TYPE_NEEDS = [
  { value: "COMMON CARRIER", label: "Common Carrier" },
  { value: "FOLDED WHEELCHAIR", label: "Folded Wheelchair" },
  { value: "WHEELCHAIR", label: "Wheelchair" },
  { value: "VAN", label: "Van" },
] as const;

export const WAIVER_TYPES = [
  "Elderly Waiver (EW)",
  "MSHO",
  "CADI",
  "BI Waiver",
  "CAC Waiver",
  "Other",
] as const;

export const REFERRAL_SOURCES = [
  "Case Manager",
  "Clinic",
  "Social Worker",
  "Internal",
  "Other",
] as const;
