# Router browser checks

Build the production app, then run `npx playwright test --config playwright.router.config.ts --project chromium --project webkit`. Run Firefox with `npm run test:firefox:ui -- router`; its wrapper handles the affected macOS application-data lookup.
The suite serves `dist` on port 5187 and uses isolated browser contexts with synthetic sessions and intercepted remote requests. It never uses the real test account or writes to Supabase.

Coverage: sidebar navigation, browser back/forward, query and fragment preservation, nuqs page size, batched detail links, presence continuity, deferred optional dialogs/import modules, and an unsaved trip draft across token refresh before explicit cancellation. No generic navigation blocker was added.

The stale-deployment case returns a chunk 404, proves there is no automatic reload, and then publishes new asset URLs before the user presses Refresh. This models a new deployment's changed asset hashes. WebKit retained a failed import at its unchanged URL even after a reload and a `no-store` response; recovery from restoring the same failed URL is not claimed.
