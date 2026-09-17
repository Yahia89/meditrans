import assert from "node:assert/strict";
import test from "node:test";
import { canManageOrganizationAudit } from "./access.ts";
import { inspectComplianceFile, complianceFilePath, MAX_COMPLIANCE_FILE_SIZE } from "./fileValidation.ts";
import { prepareCompanyDocumentDetails } from "../company/types.ts";

test("audit access requires the acting user's owner/admin membership in the requested company", () => {
  for (const role of ["owner", "admin", "dispatch", "employee", "driver", "patient", "founder"]) {
    assert.equal(canManageOrganizationAudit("org-a", "actor", [{ org_id: "org-a", user_id: "actor", role }]), ["owner", "admin"].includes(role));
  }
  for (const memberships of [[], [{ org_id: "org-b", user_id: "actor", role: "owner" }], [{ org_id: "org-a", user_id: "other", role: "admin" }]]) {
    assert.equal(canManageOrganizationAudit("org-a", "actor", memberships), false);
  }
  assert.equal(canManageOrganizationAudit(null, "actor", []), false);
  assert.equal(canManageOrganizationAudit("org-a", null, []), false);
});

test("uploads require a matching supported header, extension and declared MIME", async () => {
  for (const [name, mime, bytes] of [
    ["policy.pdf", "application/pdf", new TextEncoder().encode("%PDF-1.7\nfixture")],
    ["scan.jpeg", "image/jpeg", new Uint8Array([255,216,255,224,0,16])],
    ["scan.png", "image/png", new Uint8Array([137,80,78,71,13,10,26,10])],
    ["scan.webp", "image/webp", new TextEncoder().encode("RIFFxxxxWEBP")],
  ]) assert.equal((await inspectComplianceFile(new File([bytes], name, { type: mime }))).mimeType, mime);
  for (const file of [
    new File(["<script>alert(1)</script>"], "policy.pdf", { type: "application/pdf" }),
    new File(["%PDF-1.7"], "policy.html", { type: "application/pdf" }),
    new File(["%PDF-1.7"], "policy.pdf", { type: "text/html" }),
    new File([], "policy.pdf", { type: "application/pdf" }),
    new File([new Uint8Array(MAX_COMPLIANCE_FILE_SIZE + 1)], "policy.pdf", { type: "application/pdf" }),
  ]) await assert.rejects(inspectComplianceFile(file));
});

test("storage paths use generated identifiers and reject traversal and unsupported files", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  assert.equal(complianceFilePath(id, "company", id, id, "pdf"), `${id}/company/${id}/${id}.pdf`);
  assert.throws(() => complianceFilePath("../another-org", "company", id, id, "pdf"));
  assert.throws(() => complianceFilePath(id, "sts", "../record", id, "pdf"));
  assert.throws(() => complianceFilePath(id, "company", id, id, "html"));
});

test("company labels and titles are required; audit year is explicit and notes are preserved", () => {
  const input = { title: " Insurance certificate ", label: " Insurance ", audit_year: "2026", notes: " First line\nSecond line " };
  assert.deepEqual(prepareCompanyDocumentDetails(input), { title: "Insurance certificate", label: "Insurance", audit_year: 2026, notes: "First line\nSecond line" });
  assert.equal(prepareCompanyDocumentDetails({ ...input, audit_year: "" }).audit_year, null);
  for (const patch of [{ title: " " }, { label: " " }, { audit_year: "2e3" }, { audit_year: "2101" }, { audit_year: "2026.5" }, { notes: "n".repeat(10001) }]) {
    assert.throws(() => prepareCompanyDocumentDetails({ ...input, ...patch }));
  }
});
