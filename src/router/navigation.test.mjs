import assert from 'node:assert/strict';
import test from 'node:test';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router';
import { getPageAccess } from './access.ts';
import { parseLegacySearch, stringifyLegacySearch, validateAppSearch, applySearchPatch } from './search.ts';

const member = (role = 'owner', changes = {}) => ({ userId: 'user-a', organizationId: 'org-a', role, isSuperAdmin: false, canManageAudit: role === 'owner' || role === 'admin', ...changes });
function testRouter(initial, access = member()) {
  const root = createRootRoute();
  const route = createRoute({ getParentRoute: () => root, path: '/', validateSearch: validateAppSearch,
    beforeLoad: ({ search, context, location }) => {
      const result = getPageAccess(search.page, context.access);
      if (!result.allowed) throw redirect({ to: '/', search: { ...search, page: result.fallback, modal: undefined }, hash: location.hash, replace: true });
    },
  });
  return createRouter({ routeTree: root.addChildren([route]), history: createMemoryHistory({ initialEntries: [initial] }), context: { access }, parseSearch: parseLegacySearch, stringifySearch: stringifyLegacySearch, isServer: false });
}

test('legacy query roundtrip preserves IDs, filters, invitation values and repeated unknown keys as strings', () => {
  const query = '?page=patient-details&id=client-a&driverId=driver-a&employeeId=employee-a&tripId=trip-a&modal=edit&from=patients&section=trips&date=2026-10-13&upload_id=upload-a&mode=patients&token=00123%2Babc%3D&limit=20&status=open&status=closed&filter=false';
  const parsed = validateAppSearch(parseLegacySearch(query));
  assert.equal(parsed.page, 'patient-details');
  assert.equal(parsed.token, '00123+abc=');
  assert.equal(parsed.filter, 'false');
  assert.equal(parsed.limit, '20');
  assert.deepEqual(parsed.status, ['open', 'closed']);
  assert.deepEqual(validateAppSearch(parseLegacySearch(stringifyLegacySearch(parsed))), parsed);
});

test('invalid route-owned parameters fall back safely without discarding valid billing filters', () => {
  const parsed = validateAppSearch(parseLegacySearch('?page=unrecognized&from=unrecognized&modal=delete&date=not-a-date&id=a&id=b&billing_status=paid&__proto__=polluted'));
  assert.equal(parsed.page, 'dashboard');
  assert.equal(parsed.from, undefined);
  assert.equal(parsed.modal, undefined);
  assert.equal(parsed.date, undefined);
  assert.equal(parsed.id, undefined);
  assert.equal(parsed.billing_status, 'paid');
  assert.equal(Object.hasOwn(parsed, '__proto__'), false);
});

test('batched detail navigation preserves return context and unrelated filter state', () => {
  const start = validateAppSearch(parseLegacySearch('?page=patient-details&id=client-a&section=trips&date=2026-10-13&limit=20'));
  const detail = applySearchPatch(start, { page: 'trip-details', tripId: 'trip-a', from: 'patient-details' });
  assert.equal(detail.id, 'client-a');
  assert.equal(detail.section, 'trips');
  assert.equal(detail.limit, '20');
  const back = applySearchPatch(detail, { page: detail.from, tripId: null, from: null });
  assert.equal(back.page, 'patient-details');
  assert.equal(back.id, 'client-a');
  assert.equal(back.tripId, undefined);
  assert.equal(back.date, '2026-10-13');
});

test('unresolved or absent membership cannot grant protected feature access', () => {
  for (const role of [null, 'patient']) {
    for (const page of ['dashboard', 'patients', 'patient-details', 'employee-details', 'trips', 'medicaid-billing', 'fees']) {
      assert.deepEqual(getPageAccess(page, member(role)), { allowed: false, fallback: 'account' });
    }
    assert.deepEqual(getPageAccess('account', member(role)), { allowed: true });
  }
  assert.equal(getPageAccess('patients', member('owner', { organizationId: null })).allowed, false);
});

test('driver and dispatch detail restrictions are enforced before rendering', () => {
  assert.deepEqual(getPageAccess('employee-details', member('driver')), { allowed: false, fallback: 'trips' });
  assert.deepEqual(getPageAccess('employee-details', member('dispatch')), { allowed: false, fallback: 'dashboard' });
  assert.deepEqual(getPageAccess('medicaid-billing', member('dispatch')), { allowed: false, fallback: 'dashboard' });
  assert.equal(getPageAccess('trip-details', member('driver')).allowed, true);
  assert.equal(getPageAccess('medicaid-billing', member('owner')).allowed, true);
});

test('audit checks require actual membership even for a super administrator', () => {
  for (const page of ['sts-inspection', 'company']) {
    assert.equal(getPageAccess(page, member('dispatch', { isSuperAdmin: true, canManageAudit: false })).allowed, false);
    assert.equal(getPageAccess(page, member('owner')).allowed, true);
  }
  assert.equal(getPageAccess('founder', member(null, { isSuperAdmin: true })).allowed, true);
});

test('signed-out bookmarks and invitation/reset routes are preserved for their public components', () => {
  const signedOut = member(null, { userId: null, organizationId: null });
  for (const page of ['patient-details', 'reset-password', 'accept-invite']) assert.equal(getPageAccess(page, signedOut).allowed, true);
});

test('Router-generated URLs retain detail parameters, modal state, filters and fragments through memory history', async () => {
  const router = testRouter('/?page=patients&limit=20#callback-fragment');
  await router.load();
  const patientLocation = router.buildLocation({ to: '/', search: previous => ({ ...previous, page: 'patient-details', id: 'client-a', from: 'patients', section: 'trips' }), hash: previous => previous });
  router.history.push(patientLocation.href);
  await router.load();
  const tripLocation = router.buildLocation({ to: '/', search: previous => ({ ...previous, page: 'trip-details', tripId: 'trip-a', from: 'patient-details', modal: 'edit' }), hash: previous => previous });
  router.history.push(tripLocation.href);
  await router.load();
  assert.equal(router.state.location.hash, 'callback-fragment');
  assert.equal(router.state.location.search.modal, 'edit');
  router.history.back();
  await router.load();
  assert.equal(router.state.location.search.page, 'patient-details');
  assert.equal(router.state.location.search.id, 'client-a');
  assert.equal(router.state.location.search.limit, '20');
  assert.equal(router.state.location.search.modal, undefined);
  router.history.forward();
  await router.load();
  assert.equal(router.state.location.search.tripId, 'trip-a');
  assert.equal(router.state.location.search.modal, 'edit');
  assert.equal(router.state.location.hash, 'callback-fragment');
});

test('beforeLoad redirects unauthorized deep links and preserves unrelated parameters', async () => {
  const router = testRouter('/?page=employee-details&employeeId=employee-a&limit=20#fragment', member('dispatch'));
  await router.load();
  // In a memory runtime inspect the redirect destination, then follow it.
  const redirection = router._serverResult?.redirect ?? router.state.redirect;
  assert.ok(redirection, 'the restricted route must produce a redirect before rendering');
  const destination = router.buildLocation(redirection.options);
  router.history.replace(destination.href);
  await router.load();
  assert.equal(router.state.location.search.page, 'dashboard');
  assert.equal(router.state.location.search.limit, '20');
  assert.equal(router.state.location.hash, 'fragment');
});
