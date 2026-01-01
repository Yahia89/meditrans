export type ImportSource = "drivers" | "patients" | "employees" | "trips";

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: Record<string, any>[];
  totalRows: number;
}

export type ImportMode = "append" | "overwrite";

export interface UploadState {
  step: "select" | "preview" | "staging";
  file: File | null;
  sheets: ParsedSheet[];
  selectedSheet: string;
  importSource: ImportSource;
  importMode: ImportMode;
  isProcessing: boolean;
  error: string | null;
}

export interface UploadRecord {
  id: string;
  source: ImportSource;
  original_filename: string;
  status: string;
  created_at: string;
  processed_at: string | null;
  notes: string | null;
  file_size?: number;
  mime_type?: string;
  uploaded_by?: string;
  uploaded_by_profile?: { full_name: string };
  committed_by?: string;
  committed_by_profile?: { full_name: string };
}

export const COLUMN_MAPPINGS: Record<ImportSource, Record<string, string[]>> = {
  drivers: {
    full_name: [
      "name",
      "full_name",
      "fullname",
      "driver",
      "driver_name",
      "driver name",
      "first name",
      "last name",
      "contact name",
    ],
    email: ["email", "email_address", "e-mail", "mail"],
    phone: [
      "phone",
      "mobile",
      "cell",
      "contact",
      "phone_number",
      "phone number",
      "phone #",
      "contact phone",
    ],
    id_number: [
      "id",
      "id_number",
      "id number",
      "employee id",
      "driver id",
      "license id",
    ],
    address: [
      "address",
      "street",
      "primary_address",
      "primary address",
      "location",
      "residence",
    ],
    county: ["county", "region", "area"],
    vehicle_type: [
      "vehicle_type",
      "vehicle type",
      "car type",
      "type",
      "service type",
    ],
    vehicle_make: [
      "make",
      "vehicle_make",
      "vehicle make",
      "brand",
      "manufacturer",
    ],
    vehicle_model: ["model", "vehicle_model", "vehicle model"],
    vehicle_color: ["color", "colour", "vehicle_color", "vehicle color"],
    license_plate: [
      "plate",
      "license_plate",
      "license plate",
      "plate #",
      "plate number",
      "tag",
    ],
    dot_medical_number: [
      "dot",
      "dot_number",
      "dot #",
      "medical number",
      "dot medical",
    ],
    dot_medical_expiration: [
      "dot_exp",
      "dot_expiration",
      "medical_expiration",
      "dot medical expiration",
    ],
    insurance_company: [
      "insurance",
      "insurance_company",
      "carrier",
      "insurance carrier",
    ],
    insurance_policy_number: [
      "policy",
      "policy_number",
      "policy #",
      "insurance policy",
    ],
    insurance_start_date: ["insurance_start", "policy_start", "effective_date"],
    insurance_expiration_date: [
      "insurance_exp",
      "policy_exp",
      "insurance_expiration",
      "expiration_date",
    ],
    inspection_date: ["inspection", "inspection_date", "last_inspection"],
    driver_record_issue_date: ["record_issue", "mvr_issue", "mvr_date"],
    driver_record_expiration: ["record_exp", "mvr_exp", "mvr_expiration"],
    license_number: [
      "license",
      "license_number",
      "dl",
      "license_no",
      "license no",
    ],
    notes: ["notes", "note", "comments", "comment", "remarks"],
  },
  patients: {
    full_name: [
      "name",
      "full_name",
      "fullname",
      "patient",
      "patient_name",
      "patient name",
      "first name",
      "last name",
    ],
    email: ["email", "email_address", "e-mail", "mail"],
    phone: [
      "phone",
      "mobile",
      "cell",
      "contact",
      "phone_number",
      "phone number",
      "phone #",
      "contact phone",
    ],
    dob: [
      "dob",
      "date_of_birth",
      "birth_date",
      "birthdate",
      "birthday",
      "born",
    ],
    primary_address: [
      "address",
      "primary_address",
      "street",
      "street_address",
      "home address",
      "pickup address",
    ],
    county: ["county", "region", "area"],
    waiver_type: ["waiver", "waiver_type", "waiver type", "insurance type"],
    referral_by: [
      "referred_by",
      "referral",
      "source",
      "referred by",
      "referral source",
    ],
    referral_date: ["referral_date", "referral date", "date_of_referral"],
    referral_expiration_date: [
      "referral_exp",
      "referral_expiration",
      "referral expiry",
    ],
    service_type: ["service", "service_type", "service type", "transport type"],
    case_manager: ["case_manager", "case manager", "cm", "worker"],
    case_manager_phone: [
      "cm_phone",
      "case_manager_phone",
      "worker_phone",
      "worker number",
    ],
    monthly_credit: ["credit", "monthly_credit", "allowance", "budget"],
    credit_used_for: ["credit_usage", "purpose", "usage"],
    vehicle_type_need: [
      "vehicle_needed",
      "needs",
      "equipment",
      "vehicle requirement",
      "vehicle_type_need",
    ],
    notes: ["notes", "note", "comments", "comment", "remarks"],
  },
  employees: {
    full_name: [
      "name",
      "full_name",
      "fullname",
      "employee",
      "employee_name",
      "staff name",
    ],
    email: ["email", "email_address", "e-mail", "work email"],
    phone: ["phone", "mobile", "cell", "contact", "phone_number", "work phone"],
    role: ["role", "title", "position", "job_title", "job"],
    department: ["department", "dept", "team", "unit"],
    hire_date: ["hire_date", "start_date", "date_hired", "joined"],
  },
  trips: {
    full_name: ["patient", "patient_name", "patient name", "name", "passenger"],
    pickup_location: [
      "pickup",
      "from",
      "pickup_location",
      "pickup address",
      "start",
    ],
    dropoff_location: [
      "destination",
      "to",
      "address",
      "drop_off",
      "dropoff",
      "dropoff address",
      "end",
    ],
    pickup_time: [
      "time",
      "date",
      "scheduled",
      "appointment",
      "pickup_time",
      "pickup time",
      "scheduled time",
    ],
    trip_type: ["type", "trip_type", "trip type", "purpose"],
    notes: ["notes", "note", "comment", "description", "instructions"],
    driver_name: ["driver", "driver_name", "driver name", "assigned_driver"],
    status: ["status", "state", "condition"],
  },
};
