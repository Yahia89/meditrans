/**
 * CSV Export Utility with Protection against CSV Formula Injection (CWE-1236).
 * Prepends a single quote to cells beginning with '=', '+', '-', '@', '\t', or '\r'.
 */

export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }
  const str = String(value);

  // If starts with risky spreadsheet formula prefixes, prepend a single quote
  let safeStr = str;
  if (/^[=+\-@\t\r]/.test(str)) {
    safeStr = "'" + str;
  }

  // Escape inner double quotes by doubling them
  const escaped = safeStr.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function generateCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const headerLine = headers.map(sanitizeCsvCell).join(",");
  const dataLines = rows.map((row) => row.map(sanitizeCsvCell).join(","));
  return [headerLine, ...dataLines].join("\r\n");
}

export function downloadCsvFile(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
