# Billing responsive layout and backend follow-through

This pass follows the TypeScript cleanup in `billing_cleanup.md`. It addresses responsive billing layouts and deployment of the required billing migrations, using the installed shadcn and Emil Kowalski design-engineering skills.

## UI changes

| Before | After | Why |
| --- | --- | --- |
| Billing content could widen the main dashboard beyond the viewport. | Dashboard flex children can shrink; billing tabs and tables scroll within their own containers. | Keeps the page and its actions within the available width, including beside the desktop sidebar. |
| Payment fields compressed into narrow columns. | Dialog fields follow the width of the dialog body; mobile fields stack. | Labels, dates and payer selections remain readable. |
| Long forms pushed save actions off screen. | Shared billing dialogs have persistent headers and footers with a scrolling body. | Actions remain reachable on phones and short landscape screens. |
| Legacy global CSS overrode headings, buttons and modal scroll locks. | Billing-scoped styles restore the existing shadcn sizing, spacing and scroll behavior. | Corrects billing without restyling the rest of the CRM. |
| Some controls lacked linked labels; controlled dialogs lost keyboard focus when closed. | Linked field labels, mobile input sizing and focus restoration to the opener. | Supports keyboard navigation and reduces accidental input zoom. |
| Unset payer follow-up days became 14 when edited. | Blank remains null; explicit zero remains zero. | Editing another payer setting does not invent follow-up terms. |
| Authorization controls suggested actions that were not implemented. | Working search and read-only agreement details replace inert controls. | Shows the actions this manual billing workspace actually supports. |

Billing retains the existing CRM identity. The obsolete automated-billing settings tab is no longer exposed in this manual workflow. This is not a redesign of other CRM pages.

## Verification

The browser suite uses synthetic records and intercepts Supabase requests. It does not create records, payments or other business data in the hosted project.

| Check | Result |
| --- | --- |
| Production build including full TypeScript check | Passed |
| Billing lint and scoped lint for the added UI/browser files | Passed with zero warnings |
| Billing unit/API/local database tests | 28 passed |
| Existing location, trip completion, driver print and compliance tests | 64 passed |
| Local database privilege and tenant-reference rollback script | Passed |
| Main responsive browser scenarios | 12 passed across six viewports |
| Detailed form, focus and reduced-motion browser scenarios | 30 passed across six viewports |
| Table scrolling, payer settings and authorization detail browser scenarios | 18 passed across six viewports |

All 60 distinct browser scenarios passed across the targeted runs. The initial runs caught and corrected missing tablet dialog margins, lost keyboard focus after closing a controlled dialog, and two test-only assumptions (a stale button label and requiring desktop tables to scroll even when all columns fit).

The wider repository's existing non-billing ESLint debt is recorded in `billing_cleanup.md`; billing lint is clean.

- Six viewports: 360×800, 390×844, 740×360, 768×1024, 1024×768 and 1440×1000.
- Populated, empty and failed-query states; all billing workspace tabs; add record, payment, record detail, payer and authorization dialogs.
- Nested submission/response/adjustment forms, payment allocation editing, multiple service lines, contained table scrolling, keyboard focus and reduced motion.
- Real browser screenshots are written under `test-results/` by Playwright. These are ignored by Git.
- Build, billing lint and billing unit/API/local-database tests are run separately from the browser layout checks.

Run:

```sh
npm run build
npm run lint:billing
npm run test:billing
npm run test:billing:ui
```

The browser suite uses installed Google Chrome, starts/reuses the Vite server on port 5173, and requires the `@playwright/test` development dependency. Local database tests require the existing `supabase_db_futuretransportation` Docker container.

## Backend

See `billing_backend_verification.md` for the exact migration versions, deployment route, permissions and local/hosted verification evidence. The Supabase plugin remained scoped to another project; the already linked, authenticated Supabase CLI supplied the authorized CRM connection. Only the three billing migrations were staged for the remote run.

## Scope limits

These changes do not certify every financial acceptance criterion in `billing_work.md`. The previously identified resubmission-linking, prefilled procedure/rate and timestamp precision gaps remain in `billing_cleanup.md`. The responsive browser suite uses fixtures; it is not a logged-in end-to-end test against hosted customer data. No frontend deployment, commit or push is part of this pass.
