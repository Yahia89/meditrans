import assert from "node:assert/strict";
import test, { after } from "node:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const requirePackage = createRequire(import.meta.url);
const XLSX = requirePackage("xlsx");
// Execute the actual production TypeScript functions and their real parser
// dependencies. Only the browser FileReader boundary is adapted to Node File.
const compiledModules = new Map();
function loadSource(url) {
  const filename = fileURLToPath(url);
  if (compiledModules.has(filename)) return compiledModules.get(filename);
  const exported = {};
  compiledModules.set(filename, exported);
  const source = readFileSync(filename, "utf8");
  const code = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function("require", "exports", code)((specifier) => specifier.startsWith(".")
    ? loadSource(new URL(`${specifier}.ts`, url))
    : requirePackage(specifier), exported);
  return exported;
}

const originalReader = globalThis.FileReader;
globalThis.FileReader = class {
  result = null;
  error = null;
  onload = null;
  onerror = null;
  async readAsArrayBuffer(file) {
    try { this.result = await file.arrayBuffer(); this.onload?.({ target: this }); }
    catch (error) { this.error = error; this.onerror?.({ target: this }); }
  }
  async readAsText(file) {
    try { this.result = await file.text(); this.onload?.({ target: this }); }
    catch (error) { this.error = error; this.onerror?.({ target: this }); }
  }
};
after(() => {
  if (originalReader === undefined) delete globalThis.FileReader;
  else globalThis.FileReader = originalReader;
});

const { parseFile, mapDataToTemplate, validateImportData, normalizeDateString, normalizeTimeString } = loadSource(new URL("./file-parser.ts", import.meta.url));
const { exportToExcel } = loadSource(new URL("../../lib/export.ts", import.meta.url));

const csv = [
  "Member ID,Patient First Name,Patient Last Name,Pickup Address,Pickup City,Pickup State,Pickup Zip,Dropoff Address,Trip Date,Pickup Time,Notes",
  '000123,Zoë,"O""Brien","100 Clinic, Suite A",Saint Paul,MN,00501,"200 Main Street",2026-10-13,1:05 PM,"العربية and 李; line one\nline two"',
  "",
  '000007,李,Chen,300 First Street,,,,400 Second Street,2026-10-14,12:00 AM,""',
].join("\r\n");

function workbookFile(bookType) {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Member ID", "Patient Name", "Trip Date", "Optional Notes", "Distance"],
    [123, "Zoë 李 — العربية", new Date(2026, 9, 13), null, 0],
    [],
    ["000007", "O'Brien, Synthetic", "2026-10-14", "line one\nline two", 12.5],
  ]);
  sheet.A2.z = "000000";
  sheet.C2.z = "yyyy-mm-dd";
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Trips");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Ignored"], ["Other worksheet"]]), "Reference");
  const bytes = XLSX.write(workbook, { bookType, type: "buffer" });
  return new File([bytes], bookType === "biff8" ? "synthetic-trips.XLS" : "synthetic-trips.xlsx");
}

test("CSV imports preserve leading zeros, Unicode, quoted commas/quotes/newlines, blanks and source rows", async () => {
  const result = await parseFile(new File([csv], "synthetic-trips.csv", { type: "text/csv" }));
  assert.equal(result.fileName, "synthetic-trips.csv");
  assert.deepEqual(result.errors, []);
  assert.equal(result.data.length, 2);
  const [first, second] = result.data;
  assert.equal(first["Member ID"], "000123");
  assert.equal(first["Patient First Name"], "Zoë");
  assert.equal(first["Patient Last Name"], 'O"Brien');
  assert.equal(first["Pickup Address"], "100 Clinic, Suite A");
  assert.equal(first["Pickup Zip"], "00501");
  assert.equal(first.Notes, "العربية and 李; line one\nline two");
  assert.equal(second["Member ID"], "000007");
  assert.equal(second["Pickup City"], "");
  assert.equal(second.Notes, "");
  assert.equal(first._original_row["Member ID"], "000123");
  assert.equal(result.headers.length, 11);
});

for (const bookType of ["biff8", "xlsx"]) {
  test(`${bookType === "biff8" ? "XLS" : "XLSX"} imports preserve formatted identifiers/dates, Unicode, zero and blank cells`, async () => {
    const result = await parseFile(workbookFile(bookType));
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.headers, ["Member ID", "Patient Name", "Trip Date", "Optional Notes", "Distance"]);
    assert.equal(result.data.length, 2, "blank sheet rows are omitted; extra worksheets are not imported");
    assert.equal(result.data[0]["Member ID"], "000123", "raw:false must preserve a numeric cell's ID format");
    assert.equal(result.data[1]["Member ID"], "000007", "text IDs keep their leading zeros");
    assert.equal(result.data[0]["Patient Name"], "Zoë 李 — العربية");
    assert.equal(result.data[0]["Trip Date"], "2026-10-13");
    assert.equal(result.data[0]["Optional Notes"], "");
    assert.equal(result.data[0].Distance, "0");
    assert.equal(result.data[1].Distance, "12.5");
    assert.equal(result.data[1]["Optional Notes"], "line one\nline two");
  });
}

test("parsed CSV maps through the real Future NEMT template and normalizes dates/times", async () => {
  const parsed = await parseFile(new File([csv], "synthetic-trips.csv"));
  const mapped = mapDataToTemplate(parsed.data, "future_nemt_template");
  const validation = validateImportData(mapped);
  assert.equal(validation.summary.valid, 2);
  assert.equal(validation.summary.invalid, 0);
  assert.equal(mapped[0].patient_full_name, 'Zoë O"Brien');
  assert.equal(mapped[0].pickup_address, "100 Clinic, Suite A, Saint Paul, MN 00501");
  assert.equal(mapped[1].pickup_address, "300 First Street");
  assert.equal(normalizeDateString(mapped[0].trip_date), "2026-10-13");
  assert.equal(normalizeTimeString(mapped[0].pickup_time), "13:05");
  assert.equal(normalizeTimeString(mapped[1].pickup_time), "00:00");
  assert.equal(normalizeDateString(""), null);
  assert.equal(normalizeDateString("not a date"), null);
});

test("exportToExcel emits a real XLSX and round-trips identifiers, Unicode, dates and optional values through parseFile", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "meditrans-spreadsheet-regression-"));
  try {
    const filename = path.join(directory, "synthetic-export");
    const rows = [
      { "Member ID": "000123", "Patient Name": "Zoë 李", "Trip Date": "2026-10-13", Notes: 'Comma, quote " and\nnew line', Distance: 0 },
      { "Member ID": "000007", "Patient Name": "العربية", "Trip Date": "2026-10-14", Notes: null, Distance: 12.5 },
    ];
    exportToExcel(rows, filename);
    assert.equal(existsSync(`${filename}.xlsx`), true);
    const bytes = readFileSync(`${filename}.xlsx`);
    assert.equal(bytes.subarray(0, 2).toString(), "PK", "XLSX is a ZIP workbook, not renamed CSV");
    const workbook = XLSX.read(bytes, { type: "buffer" });
    assert.deepEqual(workbook.SheetNames, ["Sheet1"]);
    assert.equal(workbook.Sheets.Sheet1.A2.t, "s");
    assert.equal(workbook.Sheets.Sheet1.A2.v, "000123");
    assert.equal(workbook.Sheets.Sheet1.E2.t, "n");
    const parsed = await parseFile(new File([bytes], "export.xlsx"));
    assert.deepEqual(parsed.data.map(({ _original_row, ...row }) => row), [
      { ...rows[0], Distance: "0" },
      { ...rows[1], Notes: "", Distance: "12.5" },
    ]);
    const emptyFilename = path.join(directory, "empty-export");
    exportToExcel([], emptyFilename);
    assert.equal(existsSync(`${emptyFilename}.xlsx`), false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("CSV field-count failures and unreadable/unsupported inputs remain explicit errors", async () => {
  const malformed = await parseFile(new File(["First,Last\r\nSynthetic,Rider,unexpected"], "invalid.csv"));
  assert.equal(malformed.errors.length > 0, true);
  await assert.rejects(parseFile(new File([""], "unsupported.pdf")), /Unsupported file format/);
  await assert.rejects(parseFile({ name: "unreadable.xlsx", arrayBuffer: async () => { throw new Error("Synthetic file read failure"); } }), /Failed to read file/);
});
