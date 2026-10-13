import { expect, test } from "@playwright/test";
import { broadcastSession, createStartupState, deferred, ids, identityDriverRequests, installStartupFixtures,
  revalidateIdentity, syntheticSession, users } from "./fixtures.mjs";

const company = (page, name = "Startup Alpha Company") => page.getByRole("button", { name: `${name} CRM System` });
const membershipReads = (state) => state.requests.filter((request) => request.table === "organization_memberships");
const operationalReads = (state) => state.requests.filter((request) => request.path.startsWith("/rest/")
  && !["user_profiles", "organization_memberships"].includes(request.table)
  && !(request.table === "drivers" && request.search.has("user_id")));

async function setup(context, options = {}, sessionOptions = {}) {
  const state = createStartupState(options);
  await installStartupFixtures(context, state, sessionOptions);
  return state;
}

test("signed-out startup performs no private bootstrap; successful sign-in resolves one shared identity", async ({ context, page }) => {
  const state = await setup(context, {}, { signedOut: true });
  await page.goto("/?page=dashboard");
  await expect(page.getByRole("heading", { name: "Login to your account" })).toBeVisible();
  expect(membershipReads(state)).toHaveLength(0);
  await page.getByLabel("Email", { exact: true }).fill(users.a.email);
  await page.getByLabel("Password", { exact: true }).fill("synthetic-test-password");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(company(page)).toBeVisible();
  expect(membershipReads(state)).toHaveLength(1);
  expect(identityDriverRequests(state)).toHaveLength(1);
});

test("a slow membership response keeps audit deep links and private data blocked until access resolves", async ({ context, page }) => {
  const gate = deferred();
  const state = await setup(context, { membershipGate: gate });
  try {
    await page.goto("/?page=company");
    await expect.poll(() => membershipReads(state).length).toBe(1);
    await expect(page.getByRole("heading", { name: "Company", exact: true })).toHaveCount(0);
    await expect(company(page)).toHaveCount(0);
    expect(operationalReads(state)).toHaveLength(0);
    expect(new URL(page.url()).searchParams.get("page")).toBe("company");
  } finally { gate.resolve(); }
  await expect(page.getByRole("heading", { name: "Company", exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("page")).toBe("company");
});

test("membership errors stay distinct from an empty company and the retry restores the requested route", async ({ context, page }) => {
  const state = await setup(context, { membershipError: true });
  await page.goto("/?page=company");
  await expect(page.getByText("Unable to load your workspace", { exact: true })).toBeVisible();
  await expect(company(page)).toHaveCount(0);
  expect(operationalReads(state)).toHaveLength(0);
  // One Query retry, without the SDK adding its own nested retry loop.
  expect(membershipReads(state)).toHaveLength(2);
  state.membershipError = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Company", exact: true })).toBeVisible();
});

test("confirmed no-driver identity survives token refresh and navigation without duplicate reads or GPS", async ({ context, page }) => {
  const state = await setup(context);
  await page.goto("/?page=dashboard");
  await expect(company(page)).toBeVisible();
  const initialMembershipReads = membershipReads(state).length;
  await broadcastSession(page, "TOKEN_REFRESHED", syntheticSession(users.a));
  await page.getByRole("button", { name: "Trips", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("page")).toBe("trips");
  await expect(company(page)).toBeVisible();
  expect(identityDriverRequests(state)).toHaveLength(1);
  expect(membershipReads(state)).toHaveLength(initialMembershipReads);
  expect(await page.evaluate(() => window.__startupLocationWatches)).toBe(0);
});

test("expired returning session refreshes once before the shared bootstrap", async ({ context, page }) => {
  const state = await setup(context, {}, { expired: true });
  await page.goto("/?page=company");
  await expect(page.getByRole("heading", { name: "Company", exact: true })).toBeVisible();
  expect(state.requests.filter((request) => request.table === "token")).toHaveLength(1);
  expect(identityDriverRequests(state)).toHaveLength(1);
  expect(membershipReads(state)).toHaveLength(1);
});

test("driver access rejects a billing deep link and disabled driver records do not start GPS", async ({ context, page }) => {
  const state = await setup(context, { role: "driver", hasDriver: true, driverDisabled: true });
  await page.goto("/?page=billing");
  await expect(company(page)).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get("page")).toBe("trips");
  expect(state.requests.filter((request) => request.table.startsWith("billing_"))).toHaveLength(0);
  expect(await page.evaluate(() => window.__startupLocationWatches)).toBe(0);
});

test("membership removal on revalidation unmounts private details and falls back to the account", async ({ context, page }) => {
  const state = await setup(context);
  await page.clock.install();
  await page.goto(`/?page=patient-details&id=${ids.patientA}`);
  await expect(page.getByRole("heading", { name: "Alpha Private Fixture Rider", exact: true })).toBeVisible();
  state.hasMembership = false;
  await revalidateIdentity(page);
  await expect.poll(() => membershipReads(state).length).toBe(2);
  await expect(page.getByRole("heading", { name: "Alpha Private Fixture Rider", exact: true })).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.get("page")).toBe("account");
  await expect(page.getByRole("heading", { name: "Account Settings", exact: true })).toBeVisible();
});

test("a multi-tab account switch clears previous-user detail data while the next identity is pending", async ({ context, page }) => {
  const state = await setup(context);
  await page.goto(`/?page=patient-details&id=${ids.patientA}`);
  await expect(page.getByRole("heading", { name: "Alpha Private Fixture Rider", exact: true })).toBeVisible();
  const secondTab = await context.newPage();
  await secondTab.goto("/?page=account");
  await expect(company(secondTab)).toBeVisible();
  const gate = deferred(); state.membershipGate = gate; state.current = "b";
  try {
    await broadcastSession(secondTab, "SIGNED_IN", syntheticSession(users.b));
    await expect(page.getByRole("heading", { name: "Alpha Private Fixture Rider", exact: true })).toHaveCount(0);
    await expect(company(page)).toHaveCount(0);
  } finally { gate.resolve(); }
  await expect(company(page, "Startup Beta Company")).toBeVisible();
  await expect(page.getByText("Patient not found", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Alpha Private Fixture Rider", exact: true })).toHaveCount(0);
});

test("changing the default company on revalidation replaces tenant queries and visible context", async ({ context, page }) => {
  const state = await setup(context, { multiOrg: true });
  await page.clock.install();
  await page.goto("/?page=dashboard");
  await expect(company(page)).toBeVisible();
  state.defaultOrg = "b";
  await revalidateIdentity(page);
  await expect(company(page, "Startup Beta Company")).toBeVisible();
  await expect(company(page)).toHaveCount(0);
  await expect.poll(() => state.requests.filter((request) => request.search.get("org_id") === `eq.${ids.orgB}`).length).toBeGreaterThan(0);
});

test("sign-out in one tab removes protected UI from both tabs", async ({ context, page }) => {
  await setup(context);
  await page.goto("/?page=company");
  await expect(company(page)).toBeVisible();
  const secondTab = await context.newPage();
  await secondTab.goto("/?page=company");
  await expect(company(secondTab)).toBeVisible();
  await page.getByRole("button", { name: /Startup Alpha User/ }).click();
  await page.getByRole("menuitem", { name: "Log out", exact: true }).click();
  for (const tab of [page, secondTab]) {
    await expect(tab.getByRole("heading", { name: "Login to your account" })).toBeVisible();
    await expect(company(tab)).toHaveCount(0);
    await expect(tab.getByRole("heading", { name: "Company", exact: true })).toHaveCount(0);
  }
});


test("a self-membership whose organization is hidden by RLS cannot mount an audit route", async ({ context, page }) => {
  const state = await setup(context, { hiddenOrganization: true });
  await page.goto("/?page=company");
  await expect.poll(() => new URL(page.url()).searchParams.get("page")).toBe("account");
  await expect(page.getByRole("heading", { name: "Account Settings", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Company", exact: true })).toHaveCount(0);
  expect(state.requests.filter((request) => request.table === "company_documents")).toHaveLength(0);
});
