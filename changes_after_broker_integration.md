Implemented the broker integrations feature in the existing Vite/query-page routing model.

What changed:
- Added admin-only `Brokers` navigation and page at `/?page=broker-integrations`.
- Added Supabase broker schema migration with org-scoped RLS, sync logs, import audit rows, trip links, event queue, and external trip linkage fields.
- Added `broker-integrations` Edge Function for save/test/sync/webhook ingestion with encrypted credential storage.
- Added MTM Link adapter scaffold and manual sync service that imports/updates trips.
- Added typed broker client utilities and trip type/select support for broker metadata.

Verification passed:
- `npm run build`
- `npx eslint --max-warnings=0 ...` on touched client files
- `deno check supabase/functions/broker-integrations/index.ts`

Dev server is running here:
`http://127.0.0.1:5173/?page=broker-integrations`

Before using this against Supabase, set the Edge Function secret `BROKER_CREDENTIALS_KEY`. I followed Supabase’s current guidance for [Edge Function secrets](https://supabase.com/docs/guides/functions/secrets) and [RLS on exposed schemas](https://supabase.com/docs/guides/auth/auth-deep-dive/auth-row-level-security).

Note: I left unrelated existing worktree changes untouched, including `src/components/nav-user.tsx`, `src/components/notifications-page.tsx`, and the deleted `brokers_integration.md`.