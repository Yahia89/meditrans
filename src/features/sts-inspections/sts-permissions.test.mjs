import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as reactQuery from "@tanstack/react-query";
import ts from "typescript";
import * as phosphorIcons from "@phosphor-icons/react";
import { mobileInspection } from "./testFixtures.mjs";

const requirePackage = createRequire(import.meta.url);
const sourceRoot = fileURLToPath(new URL("../../", import.meta.url));
let session;
let requests = 0;
const failRequest = () => { requests++; throw new Error("Unexpected network request during server render"); };
const mocks = {
  "@phosphor-icons/react": phosphorIcons,
  "@tanstack/react-query": reactQuery,
  "@/contexts/auth-context": { useAuth: () => ({ ...session, loading: false }) },
  "@/contexts/OrganizationContext": { useOrganization: () => ({ currentOrganization: { id: session.orgId, name: "QA Company" }, loading: false }) },
  "@/hooks/usePermissions": { usePermissions: () => ({ isSuperAdmin: !!session.founder, isDriver: session.role === "driver" }) },
  "@/components/nav-user": { NavUser: () => React.createElement("span", null, "Account menu") },
  "@/features/compliance/files": { COMPLIANCE_FILE_ACCEPT: ".pdf", openComplianceFile: failRequest },
};
const cache = new Map();
function loadSource(path) {
  const filename = [path, `${path}.tsx`, `${path}.ts`].find(existsSync);
  if (!filename) throw new Error(`Source not found: ${path}`);
  if (cache.has(filename)) return cache.get(filename);
  const exported = {};
  cache.set(filename, exported);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  new Function("require", "exports", source)((id) => {
    if (mocks[id]) return mocks[id];
    if (id === "./api" && filename.includes("sts-inspections")) return { fetchStsInspections: failRequest, fetchStsDrivers: failRequest, saveStsInspection: failRequest };
    if (id.startsWith("@/")) return loadSource(resolve(sourceRoot, id.slice(2)));
    if (id.startsWith(".")) return loadSource(resolve(dirname(filename), id));
    return requirePackage(id);
  }, exported);
  return exported;
}

const { STSInspectionPanel } = loadSource(resolve(sourceRoot, "features/sts-inspections/STSInspectionPanel"));
const { STSInspectionPage } = loadSource(resolve(sourceRoot, "components/sts-inspection-page"));
const { MobileInspectionSnapshot } = loadSource(resolve(sourceRoot, "features/sts-inspections/MobileInspectionSnapshot"));
const { AppSidebar } = loadSource(resolve(sourceRoot, "components/app-sidebar"));
const { SidebarProvider } = loadSource(resolve(sourceRoot, "components/ui/sidebar"));
const inspection = {
  id: "record-1", org_id: "org-1", driver_id: "driver-1", title: "CONFIDENTIAL inspection record",
  inspection_date: "2026-09-16", inspector_name: "Inspector", result: "passed", reference: null,
  next_due_date: null, report_filename: null, report_file_path: null,
};
function render(component, records = [inspection]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(["sts-inspections", "org-1", "all"], records);
  client.setQueryData(["sts-inspections", "org-2", "all"], []);
  client.setQueryData(["sts-drivers", "org-1"], [{ id: "driver-1", full_name: "Driver One", active: true }]);
  client.setQueryData(["sts-drivers", "org-2"], []);
  const html = renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, component));
  client.clear();
  return html;
}
function setup(role, { founder = false, memberships, orgId = "org-1" } = {}) {
  session = { user: { id: "user-1" }, orgId, role, founder,
    memberships: memberships ?? [{ org_id: "org-1", user_id: "user-1", role }] };
  requests = 0;
}
const panel = () => React.createElement(STSInspectionPanel, { orgId: session.orgId, canEdit: true, timezone: "America/Chicago" });
const sidebar = () => React.createElement(SidebarProvider, null, React.createElement(AppSidebar, { currentPage: "sts-inspection", onNavigate() {} }));

test("actual inspection panel and sidebar expose owner/admin controls and cached history", () => {
  for (const role of ["owner", "admin"]) {
    setup(role);
    const content = render(panel());
    assert.match(content, /CONFIDENTIAL inspection record/);
    assert.match(content, /Add inspection/);
    assert.match(content, /Edit CONFIDENTIAL inspection record/);
    assert.match(content, /Print results \(1\)/);
    const nav = render(sidebar());
    assert.match(nav, />STS Inspection</);
    assert.match(nav, />Company</);
    assert.equal(requests, 0);
  }
});

test("dispatch, driver, and global founder without membership cannot render cached records, edit controls, or audit navigation", () => {
  for (const config of [{ role: "dispatch" }, { role: "driver" }, { role: "founder", founder: true, memberships: [] }]) {
    setup(config.role, config);
    const content = render(panel());
    assert.doesNotMatch(content, /CONFIDENTIAL|Add inspection|Print results/);
    assert.match(content, /company owners and admins/);
    const nav = render(sidebar());
    assert.doesNotMatch(nav, />STS Inspection<|>Company</);
    assert.equal(requests, 0);
  }
});

test("company switch rechecks membership and never renders the previous organization's cached history", () => {
  setup("owner");
  assert.match(render(React.createElement(STSInspectionPage, { onDriverClick() {} })), /CONFIDENTIAL/);
  session.orgId = "org-2";
  assert.doesNotMatch(render(React.createElement(STSInspectionPage, { onDriverClick() {} })), /CONFIDENTIAL|Add inspection/);
  assert.doesNotMatch(render(sidebar()), />STS Inspection<|>Company</);
  session.memberships.push({ org_id: "org-2", user_id: "user-1", role: "admin" });
  const content = render(React.createElement(STSInspectionPage, { onDriverClick() {} }));
  assert.match(content, /No STS inspections recorded/);
  assert.doesNotMatch(content, /CONFIDENTIAL/);
  assert.equal(requests, 0);
});

test("membership must belong to the signed-in user even when sensitive queries remain cached", () => {
  setup("admin", { memberships: [{ org_id: "org-1", user_id: "another-user", role: "admin" }] });
  assert.doesNotMatch(render(panel()), /CONFIDENTIAL|Add inspection/);
  assert.doesNotMatch(render(sidebar()), />STS Inspection<|>Company</);
  assert.equal(requests, 0);
});

test("original driver checklist renders vehicle facts and every response as read-only text", () => {
  setup("admin");
  const content = render(React.createElement(MobileInspectionSnapshot, { inspection: mobileInspection, timezone: "America/Chicago" }));
  for (const text of ["Driver app checklist", "QA Driver Snapshot", "QA-PLATE", "012345", "Vehicle Brakes", "No Good", "Left brake is noisy.", "Remarks", "Wheelchair Securement"]) assert.ok(content.includes(text), `Missing snapshot detail: ${text}`);
  assert.match(content, /Original driver responses are read-only/);
  assert.doesNotMatch(content, /<input|<textarea|<select/);
});

test("synced inspections are identified as Driver app and retain Pending review in the canonical list", () => {
  setup("admin");
  const content = render(panel(), [mobileInspection]);
  assert.match(content, /Driver app/);
  assert.match(content, /Pending review/);
  assert.match(content, /Daily driver inspection/);
});
