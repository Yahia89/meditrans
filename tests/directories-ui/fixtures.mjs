import { createStartupState, ids, installStartupFixtures } from '../startup-ui/fixtures.mjs';

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const createdAt = '2026-01-01T12:00:00Z';
const base = { org_id: ids.orgA, created_at: createdAt, disabled: false, phone: '5551234567', custom_fields: {} };

export const directoryRows = {
  patients: [
    { ...base, id: uuid(901), full_name: 'Directory Alpha Client', email: 'alpha-client@example.invalid',
      date_of_birth: '1970-01-01', primary_address: '123 Fixture Street', sal_status: 'approved',
      monthly_credit: 0, user_id: null },
    { ...base, id: uuid(902), full_name: 'Directory Beta Client', email: 'beta-client@example.invalid',
      date_of_birth: '1980-01-01', sal_status: 'pending', monthly_credit: 0, user_id: null },
  ],
  drivers: [
    { ...base, id: uuid(903), full_name: 'Directory Alpha Driver', email: 'alpha-driver@example.invalid',
      user_id: null, active: true, vehicle_type: 'sedan', license_plate: 'QA-ALPHA', status: 'available' },
    { ...base, id: uuid(904), full_name: 'Directory Beta Driver', email: 'beta-driver@example.invalid',
      user_id: null, active: true, vehicle_type: 'wheelchair_van', license_plate: 'QA-BETA', status: 'offline' },
  ],
  employees: [
    { ...base, id: uuid(905), full_name: 'Directory Alpha Employee', email: 'alpha-employee@example.invalid',
      user_id: uuid(907), department: 'Dispatch', role: 'Dispatcher', system_role: 'dispatch', hire_date: '2025-01-01', status: 'active' },
    { ...base, id: uuid(906), full_name: 'Directory Beta Employee', email: 'beta-employee@example.invalid',
      user_id: null, department: 'Operations', role: 'Coordinator', system_role: null, hire_date: '2025-02-01', status: 'active' },
  ],
};

export const tripCounts = { patients: 12, drivers: 17 };

export async function installDirectoryFixtures(context, page, baseURL, { presenceGate = null, countsGate = null, countsError = false } = {}) {
  const state = createStartupState();
  await installStartupFixtures(context, state);
  const localOrigin = new URL(baseURL).origin;
  const requests = [];
  const chunks = [];
  const errors = [];
  const documents = [];
  let countFailure = countsError;
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/assets/')) chunks.push(url.pathname);
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(url.href);
  });

  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === localOrigin) return route.continue();
    if (!url.pathname.startsWith('/rest/v1/')) return route.fallback();
    const table = url.pathname.split('/').at(-1);
    const search = url.searchParams;
    const body = request.method() === 'POST' ? request.postDataJSON() : null;
    requests.push({ table, method: request.method(), path: url.pathname, search, body });
    if (table === 'directory_trip_counts') {
      if (countsGate) await countsGate.promise;
      if (countFailure) return route.fulfill({ status: 503, json: { code: 'SYNTHETIC_UNAVAILABLE', message: 'Synthetic count service unavailable' } });
      const directory = body?.p_directory;
      if (!tripCounts[directory]) return route.fulfill({ status: 400, json: { message: 'Unexpected directory count request' } });
      return route.fulfill({ headers: { 'content-range': '0-0/1', 'access-control-expose-headers': 'content-range' },
        json: [{ entity_id: directoryRows[directory][0].id, total_trips: tripCounts[directory] }] });
    }
    // Bootstrap identity remains handled by the existing strict session fixture.
    if (request.method() !== 'GET') return route.fallback();
    if (search.get('org_id') !== `eq.${ids.orgA}`) return route.fallback();
    if (table === 'organization_memberships') {
      if (presenceGate) await presenceGate.promise;
      return route.fulfill({ json: [{
        id: uuid(908), org_id: ids.orgA, user_id: uuid(907), role: 'dispatch', is_primary: true,
        presence_status: 'online', last_active_at: new Date().toISOString(), created_at: createdAt,
      }] });
    }
    if (!directoryRows[table]) return route.fallback();
    const rows = directoryRows[table].filter(row => [...search].every(([column, value]) => {
      if (value.startsWith('eq.')) return String(row[column]) === value.slice(3);
      if (value === 'not.is.null') return row[column] != null;
      return true;
    }));
    const single = request.headers().accept?.includes('vnd.pgrst.object');
    return route.fulfill({ status: 200, headers: { 'content-range': `0-${rows.length - 1}/${rows.length}` }, json: single ? rows[0] ?? null : rows });
  });

  const collectionRequests = table => requests.filter(request => request.table === table
    && request.method === 'GET' && request.search.get('org_id') === `eq.${ids.orgA}`
    && !request.search.has('id') && !request.search.has('email')
    // The shell performs separate five-ID onboarding existence probes.
    && !(request.search.get('select') === 'id' && request.search.get('limit') === '5'));
  return { state, requests, collectionRequests, chunks, errors, documents, setCountsError: value => { countFailure = value; } };
}
