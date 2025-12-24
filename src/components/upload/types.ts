export type ImportSource = 'drivers' | 'patients' | 'employees' | 'trips'

export interface ParsedSheet {
    name: string
    headers: string[]
    rows: Record<string, any>[]
    totalRows: number
}

export interface UploadState {
    step: 'select' | 'preview' | 'staging'
    file: File | null
    sheets: ParsedSheet[]
    selectedSheet: string
    importSource: ImportSource
    isProcessing: boolean
    error: string | null
}

export interface UploadRecord {
    id: string
    source: ImportSource
    original_filename: string
    status: string
    created_at: string
    processed_at: string | null
    notes: string | null
    file_size?: number
    mime_type?: string
    committed_by?: string
    committed_by_profile?: { full_name: string }
}

export const COLUMN_MAPPINGS: Record<ImportSource, Record<string, string[]>> = {
    drivers: {
        full_name: ['name', 'full_name', 'fullname', 'driver', 'driver_name', 'driver name'],
        email: ['email', 'email_address', 'e-mail'],
        phone: ['phone', 'mobile', 'cell', 'contact', 'phone_number', 'phone number'],
        license_number: ['license', 'license_number', 'dl', 'license_no', 'license no'],
        vehicle_info: ['vehicle', 'car', 'vehicle_info', 'make_model', 'make', 'model'],
    },
    patients: {
        full_name: ['name', 'full_name', 'fullname', 'patient', 'patient_name', 'patient name'],
        email: ['email', 'email_address', 'e-mail'],
        phone: ['phone', 'mobile', 'cell', 'contact', 'phone_number', 'phone number'],
        date_of_birth: ['dob', 'date_of_birth', 'birth_date', 'birthdate', 'birthday'],
        primary_address: ['address', 'primary_address', 'street', 'street_address'],
        notes: ['notes', 'note', 'comments', 'comment'],
    },
    employees: {
        full_name: ['name', 'full_name', 'fullname', 'employee', 'employee_name'],
        email: ['email', 'email_address', 'e-mail'],
        phone: ['phone', 'mobile', 'cell', 'contact', 'phone_number'],
        role: ['role', 'title', 'position', 'job_title'],
        department: ['department', 'dept', 'team'],
        hire_date: ['hire_date', 'start_date', 'date_hired', 'joined'],
    },
    trips: {
        full_name: ['patient', 'patient_name', 'patient name', 'name'],
        destination: ['destination', 'to', 'address', 'drop_off', 'dropoff'],
        scheduled_time: ['time', 'date', 'scheduled', 'appointment'],
        notes: ['notes', 'note', 'comment', 'description'],
    },
}
