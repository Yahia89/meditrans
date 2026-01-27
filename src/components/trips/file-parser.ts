/**
 * File parsing utilities for bulk trip import
 * Supports CSV, XLS, and XLSX files
 */

import * as XLSX from "xlsx";
import Papa from "papaparse";
import type { TripImportRow } from "./broker-templates";
import { getTemplateById } from "./broker-templates";

export interface ParseResult {
  data: TripImportRow[];
  headers: string[];
  errors: string[];
  fileName: string;
}

/**
 * Parse CSV file using PapaParse
 */
function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const data = results.data as any[];
        const errors: string[] = [];

        if (results.errors.length > 0) {
          results.errors.forEach((error) => {
            errors.push(`Row ${error.row}: ${error.message}`);
          });
        }

        resolve({
          data: data.map((row) => ({ ...row, _original_row: row })),
          headers,
          errors,
          fileName: file.name,
        });
      },
      error: (error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      },
    });
  });
}

/**
 * Parse Excel file (XLS/XLSX) using SheetJS
 */
function parseExcel(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        // Get the first worksheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to JSON with header row
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          raw: false, // Keep values as strings
          defval: "", // Default value for empty cells
        });

        // Extract headers
        const headers = Object.keys(jsonData[0] || {});

        resolve({
          data: jsonData.map((row: any) => ({ ...row, _original_row: row })),
          headers,
          errors: [],
          fileName: file.name,
        });
      } catch (error) {
        reject(
          new Error(
            `Excel parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          ),
        );
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Main parsing function that routes to the appropriate parser
 */
export async function parseFile(file: File): Promise<ParseResult> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "csv":
      return parseCSV(file);
    case "xls":
    case "xlsx":
      return parseExcel(file);
    default:
      throw new Error(
        `Unsupported file format: ${extension}. Please upload CSV, XLS, or XLSX files.`,
      );
  }
}

/**
 * Map parsed data to our internal structure based on template
 */
export function mapDataToTemplate(
  data: any[],
  templateId: string,
): TripImportRow[] {
  const template = getTemplateById(templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  return data.map((row) => {
    const mappedRow: TripImportRow = {
      _original_row: row,
      _validation_errors: [],
    };

    // Map each field based on template
    template.fields.forEach((field) => {
      const value = row[field.name];

      // Validate required fields
      if (field.required && (!value || value.trim() === "")) {
        mappedRow._validation_errors?.push(
          `Missing required field: ${field.name}`,
        );
      }

      // Map to internal structure if mapping exists
      if (field.mapTo && value) {
        mappedRow[field.mapTo] = value;
      }
    });

    // Build full name if we have first and last
    if (mappedRow.patient_first_name && mappedRow.patient_last_name) {
      mappedRow.patient_full_name = `${mappedRow.patient_first_name} ${mappedRow.patient_last_name}`;
    }

    // Build full addresses
    if (
      mappedRow.pickup_address &&
      mappedRow.pickup_city &&
      mappedRow.pickup_state &&
      mappedRow.pickup_zip
    ) {
      const addr2 = mappedRow.pickup_address_2
        ? `, ${mappedRow.pickup_address_2}`
        : "";
      mappedRow.pickup_address = `${mappedRow.pickup_address}${addr2}, ${mappedRow.pickup_city}, ${mappedRow.pickup_state} ${mappedRow.pickup_zip}`;
    }

    if (
      mappedRow.dropoff_address &&
      mappedRow.dropoff_city &&
      mappedRow.dropoff_state &&
      mappedRow.dropoff_zip
    ) {
      const addr2 = mappedRow.dropoff_address_2
        ? `, ${mappedRow.dropoff_address_2}`
        : "";
      mappedRow.dropoff_address = `${mappedRow.dropoff_address}${addr2}, ${mappedRow.dropoff_city}, ${mappedRow.dropoff_state} ${mappedRow.dropoff_zip}`;
    }

    return mappedRow;
  });
}

/**
 * Validate imported data
 */
export function validateImportData(data: TripImportRow[]): {
  valid: TripImportRow[];
  invalid: TripImportRow[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    errorTypes: Record<string, number>;
  };
} {
  const valid: TripImportRow[] = [];
  const invalid: TripImportRow[] = [];
  const errorTypes: Record<string, number> = {};

  data.forEach((row) => {
    const errors = row._validation_errors || [];

    // Additional validation
    if (!row.pickup_address) {
      errors.push("Pickup address is required");
    }
    if (!row.dropoff_address) {
      errors.push("Dropoff address is required");
    }
    if (!row.trip_date) {
      errors.push("Trip date is required");
    }
    if (
      !row.patient_full_name &&
      !row.patient_first_name &&
      !row.patient_last_name
    ) {
      errors.push("Patient name is required");
    }

    // Update validation errors
    row._validation_errors = errors;

    // Track error types
    errors.forEach((error) => {
      errorTypes[error] = (errorTypes[error] || 0) + 1;
    });

    // Classify row
    if (errors.length === 0) {
      valid.push(row);
    } else {
      invalid.push(row);
    }
  });

  return {
    valid,
    invalid,
    summary: {
      total: data.length,
      valid: valid.length,
      invalid: invalid.length,
      errorTypes,
    },
  };
}

/**
 * Convert date string to YYYY-MM-DD format
 */
export function normalizeDateString(dateStr: string): string | null {
  if (!dateStr) return null;

  try {
    // Try parsing various date formats
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;

    // Return in YYYY-MM-DD format
    return date.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

/**
 * Convert time string to HH:MM format
 */
export function normalizeTimeString(timeStr: string): string | null {
  if (!timeStr) return null;

  try {
    // Handle various time formats
    const timeMatch = timeStr.match(
      /(\d{1,2}):(\d{2})(?::(\d{2}))?(\s*[AaPp][Mm])?/,
    );
    if (!timeMatch) return null;

    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2];
    const ampm = timeMatch[4]?.trim().toUpperCase();

    // Convert to 24-hour format if AM/PM is present
    if (ampm) {
      if (ampm === "PM" && hours < 12) hours += 12;
      if (ampm === "AM" && hours === 12) hours = 0;
    }

    return `${String(hours).padStart(2, "0")}:${minutes}`;
  } catch {
    return null;
  }
}
