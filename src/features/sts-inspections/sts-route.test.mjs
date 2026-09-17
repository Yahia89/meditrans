import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const requirePackage = createRequire(import.meta.url);
let state;
let effects = [];
const passThrough = ({ children }) => children;
const noContent = () => null;
const providers = {
  auth: { AuthProvider: passThrough, useAuth: () => ({ user: state.user, memberships: state.memberships, loading: state.authLoading }) },
  organization: { OrganizationProvider: passThrough, useOrganization: () => ({ currentOrganization: state.orgId ? { id: state.orgId } : null, userRole: state.role, loading: state.orgLoading }) },
};
const mocks = {
  react: {
    ...React,
    // Flush the real App effect after each server render to test its redirects.
    useEffect: (callback) => effects.push(callback),
    lazy: (load) => {
      const source = load.toString();
      return source.includes("sts-inspection-page") || source.includes("CompanyDocumentsPage")
        ? () => React.createElement("span", null, "PROTECTED AUDIT PAGE") : noContent;
    },
  },
  nuqs: {
    useQueryState: (key) => [key === "page" ? state.page : null, (value) => { if (key === "page") state.page = value; }],
    parseAsStringLiteral: () => ({ withDefault() { return this; }, withOptions() { return this; } }),
  },
  "@/contexts/auth-context": providers.auth,
  "@/contexts/OrganizationContext": providers.organization,
  "@/contexts/OnboardingContext": { OnboardingProvider: passThrough },
  "@/components/ui/sidebar": { SidebarProvider: passThrough },
  "./components/app-sidebar": { AppSidebar: noContent },
  "./components/dashboard-page": { DashboardPage: passThrough },
  "./components/login-form": { LoginForm: noContent },
  "./components/error-boundary": { ErrorBoundary: passThrough },
  "@/hooks/usePermissions": { usePermissions: () => ({ isDriver: state.role === "driver", isSuperAdmin: !!state.founder }) },
  "@/hooks/usePresence": { usePresence() {} },
  "@/hooks/useDriverLocation": { useDriverLocation: () => ({ driverId: null }) },
  sonner: { Toaster: noContent },
};
const sources = {
  "@/hooks/useAuditAccess": "../../hooks/useAuditAccess.ts",
  "@/features/compliance/access": "../compliance/access.ts",
  "@/lib/pages": "../../lib/pages.ts",
};
function loadSource(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  const code = ts.transpileModule(readFileSync(url, "utf8"), {
    fileName: url.pathname,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exported = {};
  new Function("require", "exports", code)((id) => {
    if (mocks[id]) return mocks[id];
    if (sources[id]) return loadSource(sources[id]);
    if (/\.(css|png)$/.test(id)) return "test-asset";
    return requirePackage(id);
  }, exported);
  return exported;
}
const App = loadSource("../../App.tsx").default;
function renderAndFlush() {
  effects = [];
  const html = renderToStaticMarkup(React.createElement(App));
  for (const effect of effects) effect();
  return html;
}

test("audit deep links survive auth resolving before the organization on a full reload", async () => {
  for (const page of ["sts-inspection", "company"]) {
    state = { page, user: null, memberships: [], orgId: null, role: null, authLoading: true, orgLoading: false };
    assert.doesNotMatch(renderAndFlush(), /PROTECTED AUDIT PAGE/);
    assert.equal(state.page, page);
    await Promise.resolve();
    state.user = { id: "admin-user" };
    state.authLoading = false;
    state.memberships = [{ org_id: "org-1", user_id: "admin-user", role: "admin" }];
    // This intermediate state caused the regression: neither loader is true yet,
    // but OrganizationProvider has not selected the membership's organization.
    assert.doesNotMatch(renderAndFlush(), /PROTECTED AUDIT PAGE/);
    assert.equal(state.page, page);
    await Promise.resolve();
    state.orgLoading = true;
    assert.doesNotMatch(renderAndFlush(), /PROTECTED AUDIT PAGE/);
    assert.equal(state.page, page);
    await Promise.resolve();
    state.orgLoading = false;
    state.orgId = "org-1";
    state.role = "admin";
    assert.match(renderAndFlush(), /PROTECTED AUDIT PAGE/);
    assert.equal(state.page, page);
  }
});

test("resolved unauthorized audit links stay unmounted and redirect for every restricted role", () => {
  for (const page of ["sts-inspection", "company"]) {
    for (const [role, founder, fallback] of [["dispatch", false, "dashboard"], ["driver", false, "trips"], ["founder", true, "companies"]]) {
      state = { page, user: { id: "user-1" }, memberships: [], orgId: "org-1", role, founder, authLoading: false, orgLoading: false };
      assert.doesNotMatch(renderAndFlush(), /PROTECTED AUDIT PAGE/);
      assert.equal(state.page, fallback);
    }
  }
});
