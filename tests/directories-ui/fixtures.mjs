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

export function createDirectoryRows(count = 13, orgId = ids.orgA) {
  return Object.fromEntries(Object.entries(directoryRows).map(([directory, originals], directoryIndex) => [directory,
    Array.from({ length: count }, (_, index) => ({ ...originals[index % 2],
      id: uuid(1000 + directoryIndex * 100 + index), org_id: orgId,
      full_name: `Synthetic ${directory} ${String(index + 1).padStart(2, '0')}`,
      email: `fixture-${directory}-${index + 1}@example.invalid`,
      user_id: directory === 'employees' && index % 2 === 0 ? uuid(907) : null,
    })),
  ]));
}

export async function installDirectoryFixtures(context, page, baseURL, {
  presenceGate = null, countsGate = null, countsError = false, presenceError = false,
  rows = directoryRows, listGate = null, listErrors = [], codeGate = null, codePage = null,
  stateOverrides = {}, expired = false, signedOut = false, savedView = null,
} = {}) {
  const state = createStartupState(stateOverrides);
  await installStartupFixtures(context, state, { expired, signedOut });
  if (savedView) await context.addInitScript(value => localStorage.setItem('patients-view-mode', value), savedView);
  const localOrigin = new URL(baseURL).origin;
  const requests = [];
  const chunks = [];
  const errors = [];
  const documents = [];
  let countFailure = countsError;
  let presenceFailure = presenceError;
  const listFailures = new Set(listErrors);
  let listFailureStatus = 503;
  const collectionRows = structuredClone(rows);
  const consoleErrors = [];
  const consoleMessages = [];
  const diagnosticReads = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleMessages.push(message.text());
    if (/UI boundary diagnostic|React UI diagnostic/.test(message.text())) {
      diagnosticReads.push(Promise.all(message.args().map(argument => argument.jsonValue().catch(() => '[unavailable]'))));
    }
    if (message.type() === 'error' && /too many re-renders|maximum update depth|render.*different component|change in the order of hooks|minified react error|errorboundary|the above error|UI boundary diagnostic|React UI diagnostic/i.test(message.text())) {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/assets/')) chunks.push(url.pathname);
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(url.href);
  });

  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === localOrigin) {
      if (codeGate && (url.pathname.includes(`/${codePage}-page-`) || url.pathname.endsWith(`/${codePage}-page.tsx`))) await codeGate.promise;
      return route.continue();
    }
    if (!url.pathname.startsWith('/rest/v1/')) return route.fallback();
    const table = url.pathname.split('/').at(-1);
    const search = url.searchParams;
    const body = request.method() === 'POST' ? request.postDataJSON() : null;
    requests.push({ table, method: request.method(), path: url.pathname, search, body });
    if (table === 'directory_trip_counts') {
      if (countsGate) await countsGate.promise;
      if (countFailure) return route.fulfill({ status: 503, json: { code: 'SYNTHETIC_UNAVAILABLE', message: 'Synthetic count service unavailable' } });
      const directory = body?.p_directory;
      if (body?.p_org_id !== ids.orgA) return route.fulfill({ headers: { 'content-range': '0-0/0', 'access-control-expose-headers': 'content-range' }, json: [] });
      if (!tripCounts[directory]) return route.fulfill({ status: 400, json: { message: 'Unexpected directory count request' } });
      if (collectionRows[directory].length === 0) return route.fulfill({ headers: { 'content-range': '0-0/0', 'access-control-expose-headers': 'content-range' }, json: [] });
      return route.fulfill({ headers: { 'content-range': '0-0/1', 'access-control-expose-headers': 'content-range' },
        json: [{ entity_id: collectionRows[directory][0]?.id, total_trips: tripCounts[directory] }] });
    }
    // Bootstrap identity remains handled by the existing strict session fixture.
    if (request.method() !== 'GET') return route.fallback();
    if (search.get('org_id') !== `eq.${ids.orgA}`) return route.fallback();
    if (table === 'organization_memberships') {
      if (presenceGate) await presenceGate.promise;
      if (presenceFailure) return route.fulfill({ status: 503, json: { code: 'SYNTHETIC_UNAVAILABLE', message: 'Synthetic presence unavailable' } });
      return route.fulfill({ json: [{
        id: uuid(908), org_id: ids.orgA, user_id: uuid(907), role: 'dispatch', is_primary: true,
        presence_status: 'online', last_active_at: new Date().toISOString(), created_at: createdAt,
      }] });
    }
    if (!collectionRows[table]) return route.fallback();
    const isCollection = !search.has('id') && !search.has('email') && !(search.get('select') === 'id' && search.get('limit') === '5');
    if (isCollection && listGate) await listGate.promise;
    if (isCollection && listFailures.has(table)) return route.fulfill({ status: listFailureStatus, json: { code: listFailureStatus === 403 ? '42501' : 'SYNTHETIC_UNAVAILABLE', message: 'Synthetic directory unavailable' } });
    const rows = collectionRows[table].filter(row => [...search].every(([column, value]) => {
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
  return { state, requests, collectionRequests, chunks, errors, consoleErrors, consoleMessages, documents,
    captureDiagnostics: () => Promise.all(diagnosticReads),
    setCountsError: value => { countFailure = value; },
    setPresenceError: value => { presenceFailure = value; },
    setListError: (directory, value, status = 503) => { listFailureStatus = status; return value ? listFailures.add(directory) : listFailures.delete(directory); },
    replaceRows: (directory, nextRows) => { collectionRows[directory] = structuredClone(nextRows); },
  };
}
