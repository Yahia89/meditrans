# Driver printing, STS inspections, and company audit documents

Implemented in the web repository. The three reviewed Supabase migrations are
deployed; the frontend is built locally and has not been published. No mobile app
was changed or driven during this round. Existing unrelated changes were preserved.

## Available workflows

- **Driver → Print Out:** independently select basic information (including all
  notes), exact assigned trip count across all statuses, and STS history. The
  generated PDF always identifies that individual driver. Selected data is read
  fresh; a failed query stops generation instead of printing an incorrect zero.
- **Driver → STS Inspection:** view, add, edit, and print that driver's inspection
  records and attached reports. This tab and STS print selection require an
  actual owner/admin membership in the driver's organization.
- **Sidebar → STS Inspection:** company-wide history with driver, result, date,
  and text filters, individual or selected-record printing, and report access.
- **Sidebar footer → Company:** private document library with title, label,
  optional audit year, notes, original uploader, upload date/time, and last edit
  time. Search/filter documents, edit metadata, view/print/download files, and
  export the filtered document register as a printable PDF.

Company and STS access is enforced both in the interface and database/Storage
policies. Dispatchers, drivers, other companies, and a global administrator
without a qualifying organization membership cannot access these records/files.
Original company uploads and attribution are retained; changing a title or label
does not replace the original file or uploader. STS report replacement uses a new
file and protects the existing report if saving fails. Concurrent edits fail
explicitly rather than silently overwriting another editor's changes.

Files may be PDF, JPEG, PNG, or WebP, up to 20 MiB. The browser downloads through
authenticated Storage access; it does not expose public document links. Uploaded
PDFs open in the native browser viewer; images are fitted to A4 for printing.
Generated STS previews use the viewer's print control rather than an automatic
PDF print action. Driver reports and company registers download as printable PDFs.

## Verification

- **45 focused tests passed:** driver printing 8, compliance/STS 23, web trip
  completion 9, browser event location 5.
- Scoped ESLint passed across the 25 changed TypeScript files; the final print
  changes passed scoped lint again. Production Vite build and diff checks passed.
- TypeScript still reports the same 7 existing errors in CreditEntryDialog,
  driver-history-page, CreateTripForm, scheduler constants, TripList, TripTimeline,
  and geo. No new TypeScript errors were introduced.
- **89 live backend checks passed:** 28 administrative completion checks,
  32 compliance SQL/RLS checks, and 29 real authenticated REST/Storage checks.
  See [backend contract and migration verification](WEB_COMPLIANCE_BACKEND_2026-09-16.md).
- Argent Chromium browser QA used disposable admin and dispatcher accounts.
  Admin uploaded a company PDF, edited its title, and retained original attribution;
  added/edited an STS record with a PNG report; viewed PDF and image print previews;
  viewed the same history in the driver's tab; and generated full and count-only
  driver reports plus the company register. Actual downloaded PDFs were rendered
  and checked. Dispatcher navigation, direct links, driver STS tab, and report
  options correctly denied STS/company access.
- Full-reload deep links were verified after fixing an organization-loading race.
  At a 390 × 844 browser viewport, company/STS pages had no page-wide horizontal
  overflow, the wide inspection table scrolled within its container, and forms
  stayed within the viewport with internal scrolling where needed.
- The STS PDF's automatic print action caused the headless PDF viewer to crash.
  Removing that action produced a clean rendered preview with the standard print
  toolbar; the same automatic action was removed from company-register downloads.

Evidence is under `/tmp/meditrans-audit-qa/`: `browser/` contains Argent screenshots
and actual downloaded PDF verification; `pdf/` contains checkbox combinations and
long-content pagination checks; `sts-print/` contains inspection PDF checks; and
`final-checks/` contains test, lint, build, and baseline TypeScript logs. Evidence
uses synthetic records only. Temporary browser accounts, organizations, records,
Storage files, credentials, and task Argent secrets were removed and verified
absent. The task's Argent Chromium connection was stopped.

## Remaining inputs / next round

- Provide the exact STS checklist/form if structured checklist questions or a
  mandated print layout are required. This implementation records inspection
  details and original reports; it does not invent inspection results or claim
  that its fields constitute an official DHS/STS checklist.
- Upload the company's actual audit documents and existing inspection reports.
  Legacy driver inspection dates were not converted into fabricated history.
- Publish the web frontend through the normal release process when ready. The
  backend is already deployed. No Git commit, push, or frontend publication was
  performed here.
- The 7 pre-existing TypeScript errors remain a separate cleanup item.
