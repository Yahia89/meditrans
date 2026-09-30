import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { BILLING_FILE_MAX_BYTES, validateBillingFile, billingFileContentType } from "../utils/documents.ts";

const requirePackage = createRequire(import.meta.url);
function loadDocuments(billingDb, supabase) {
  const cache = new Map();
  function load(url) {
    if (cache.has(url.href)) return cache.get(url.href);
    const code = ts.transpileModule(readFileSync(url, "utf8"), {
      fileName: url.pathname,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const exported = {};
    cache.set(url.href, exported);
    new Function("require", "exports", code)((id) => {
      if (id === "./client") return { billingDb };
      if (id === "@/lib/supabase") return { supabase };
      if (id.startsWith(".")) return load(new URL(id.endsWith(".ts") ? id : `${id}.ts`, url));
      return requirePackage(id);
    }, exported);
    return exported;
  }
  return load(new URL("../api/documents.ts", import.meta.url));
}

function storageFixture(options = {}) {
  const objects = new Set();
  const metadata = new Map();
  const uploads = [];
  const removals = [];
  const signed = [];
  const dbError = { code: "23514", message: "Document metadata could not be saved" };
  const bucket = {
    async upload(path, file, uploadOptions) {
      uploads.push({ path, file, options: uploadOptions });
      if (options.failFile === file.name) return { error: new Error("Storage temporarily unavailable") };
      if (objects.has(path)) return { error: { statusCode: options.duplicateStatus ?? "409", message: "The resource already exists" } };
      objects.add(path);
      return { error: null };
    },
    async remove(paths) {
      removals.push(...paths);
      paths.forEach((path) => objects.delete(path));
      return { error: null };
    },
    async createSignedUrl(...args) {
      signed.push(args);
      return options.signError ? { error: new Error("Access denied"), data: null } : { error: null, data: { signedUrl: "https://storage.invalid/signed?token=short-lived" } };
    },
  };
  const supabase = { storage: { from(name) { assert.equal(name, "billing-documents"); return bucket; } } };
  const billingDb = {
    from(table) {
      assert.equal(table, "billing_documents");
      let inserted, selectedId;
      const query = {
        insert(value) { inserted = value; return query; },
        select() { return query; },
        eq(field, value) { assert.equal(field, "id"); selectedId = value; return query; },
        async single() {
          const row = { ...inserted, uploaded_at: "2026-09-26T12:00:00Z", uploaded_by: "user-1" };
          if (!options.failMetadata || options.commitDespiteError) metadata.set(row.id, row);
          return options.failMetadata ? { error: dbError, data: null } : { error: null, data: row };
        },
        async maybeSingle() {
          return options.failLookup ? { error: new Error("Connection lost"), data: null } : { error: null, data: metadata.get(selectedId) ?? null };
        },
      };
      return query;
    },
  };
  return { ...loadDocuments(billingDb, supabase), objects, metadata, uploads, removals, signed, dbError };
}
const upload = (file) => ({ orgId: "org-1", recordId: "record-1", file, documentType: "other" });

test("billing files reject empty, oversized, unsupported and mismatched uploads", () => {
  assert.match(validateBillingFile({ name: "receipt.pdf", type: "application/pdf", size: 0 }), /empty/);
  assert.match(validateBillingFile({ name: "receipt.pdf", type: "application/pdf", size: BILLING_FILE_MAX_BYTES + 1 }), /20 MB/);
  assert.match(validateBillingFile({ name: "receipt.html", type: "text/html", size: 50 }), /Choose a PDF/);
  assert.match(validateBillingFile({ name: "receipt.pdf", type: "text/html", size: 50 }), /does not match/);
  assert.equal(validateBillingFile({ name: "receipt.pdf", type: "application/pdf", size: BILLING_FILE_MAX_BYTES }), null);
  assert.equal(validateBillingFile({ name: "billing.csv", type: "application/vnd.ms-excel", size: 50 }), null);
  assert.equal(billingFileContentType({ name: "BILLING.XLSX" }), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
});

test("invalid file never reaches Storage or metadata", async () => {
  const api = storageFixture();
  await assert.rejects(api.uploadBillingDocument(upload(new File(["<script>"], "claim.html", { type: "text/html" }))), /Choose a PDF/);
  assert.equal(api.uploads.length, 0);
  assert.equal(api.metadata.size, 0);
});

test("failed metadata removes only the unattached uploaded object", async () => {
  const api = storageFixture({ failMetadata: true });
  await assert.rejects(api.uploadBillingDocument(upload(new File(["%PDF-1.7"], "claim.pdf", { type: "application/pdf" }))), (error) => error === api.dbError);
  assert.equal(api.objects.size, 0);
  assert.deepEqual(api.removals, [api.uploads[0].path]);
});

test("a lost metadata response returns the committed document without deleting it", async () => {
  const api = storageFixture({ failMetadata: true, commitDespiteError: true });
  const document = await api.uploadBillingDocument(upload(new File(["%PDF-1.7"], "claim.pdf", { type: "application/pdf" })));
  assert.equal(document.file_name, "claim.pdf");
  assert.equal(api.metadata.size, 1);
  assert.equal(api.objects.size, 1);
  assert.equal(api.removals.length, 0);
});

test("uncertain metadata keeps its file and a retry reuses the same upload identity", async () => {
  const options = { failMetadata: true, failLookup: true };
  const api = storageFixture(options);
  const file = new File(["%PDF-1.7"], "claim.pdf", { type: "application/pdf" });
  await assert.rejects(api.uploadBillingDocument(upload(file)));
  assert.equal(api.removals.length, 0);
  options.failMetadata = false;
  options.failLookup = false;
  const document = await api.uploadBillingDocument(upload(file));
  assert.equal(api.uploads[0].path, api.uploads[1].path);
  assert.equal(document.storage_path, api.uploads[0].path);
  assert.equal(api.metadata.size, 1);
  assert.equal(api.objects.size, 1);
  assert.equal(api.uploads[0].options.upsert, false);
});

test("partial batch failure retains only the files that still need uploading", async () => {
  const api = storageFixture({ failFile: "receipt.pdf" });
  const first = new File(["a"], "claim.pdf", { type: "application/pdf" });
  const second = new File(["b"], "receipt.pdf", { type: "application/pdf" });
  const result = await api.uploadBillingFiles({ orgId: "org-1", recordId: "record-1", files: [first, second] });
  assert.equal(result.uploadedCount, 1);
  assert.deepEqual(result.failedFiles, [second]);
  assert.match(result.errors[0], /receipt.pdf: Storage temporarily unavailable/);
  assert.equal(api.metadata.size, 1);
});

test("legacy Storage duplicate responses can safely finish a retried attachment", async () => {
  const options = { failMetadata: true, failLookup: true, duplicateStatus: "400" };
  const api = storageFixture(options);
  const file = new File(["%PDF-1.7"], "claim.pdf", { type: "application/pdf" });
  await assert.rejects(api.uploadBillingDocument(upload(file)));
  options.failMetadata = false;
  options.failLookup = false;
  await api.uploadBillingDocument(upload(file));
  assert.equal(api.objects.size, 1);
  assert.equal(api.metadata.size, 1);
});

test("private file downloads expire after five minutes and trigger attachment downloads", async () => {
  const api = storageFixture();
  assert.match(await api.getSignedDocumentUrl("org/record/receipt.pdf"), /token=short-lived/);
  assert.deepEqual(api.signed, [["org/record/receipt.pdf", 300, { download: true }]]);
  await assert.rejects(storageFixture({ signError: true }).getSignedDocumentUrl("other-org/receipt.pdf"), /Access denied/);
});
