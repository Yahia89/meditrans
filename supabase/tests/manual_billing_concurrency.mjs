import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import test from "node:test";

const run = promisify(execFile);
async function sql(query) {
  const { stdout } = await run("docker", [
    "exec", "supabase_db_futuretransportation", "psql", "-U", "postgres", "-d", "postgres",
    "-qAt", "-v", "ON_ERROR_STOP=1", "-c", query,
  ]);
  return stdout.trim().split("\n").at(-1);
}

test("concurrent manual retries create one record and receipts retain every amount", async () => {
  const org = randomUUID();
  const user = randomUUID();
  const patient = randomUUID();
  const asAdmin = (query) => `BEGIN; SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${user}', true); ${query}; COMMIT;`;
  try {
    await sql(`BEGIN;
      INSERT INTO public.organizations(id,name,slug) VALUES ('${org}','Concurrent billing fixture','billing-${org}');
      INSERT INTO auth.users(id,email) VALUES ('${user}','${user}@billing-concurrency.test');
      INSERT INTO public.user_profiles(user_id,full_name,default_org_id) VALUES ('${user}','Fixture admin','${org}');
      INSERT INTO public.organization_memberships(org_id,user_id,role) VALUES ('${org}','${user}','admin');
      INSERT INTO public.patients(id,org_id,full_name) VALUES ('${patient}','${org}','Fixture patient');
      COMMIT;`);
    const input = JSON.stringify({
      org_id: org, client_id: patient, request_id: randomUUID(), agency_name: "Concurrent agency",
      submitted_amount: 100, submitted_at: "2026-09-10T12:00:00Z",
    });
    const recordQuery = asAdmin(`SELECT public.create_manual_billing_record('${input}'::jsonb)->>'id'`);
    const ids = await Promise.all([sql(recordQuery), sql(recordQuery), sql(recordQuery)]);
    assert.equal(new Set(ids).size, 1, "retries must return the same record");
    const record = ids[0];
    const payment = { request_id: randomUUID(), amount: 10, received_at: "2026-09-11T12:00:00Z" };
    const receive = (receipt) => asAdmin(`SELECT public.record_billing_receipt('${record}','${JSON.stringify(receipt)}'::jsonb)->>'id'`);
    const results = await Promise.all([
      sql(receive(payment)), sql(receive(payment)),
      sql(receive({ ...payment, request_id: randomUUID(), amount: 20 })),
      sql(receive({ ...payment, request_id: randomUUID(), amount: 30 })),
    ]);
    assert.equal(results[0], results[1], "duplicate receipt must return existing payment");
    assert.equal(await sql(`SELECT json_build_object('count',count(*),'total',sum(amount))
      FROM public.billing_payments WHERE org_id='${org}'`), '{"count" : 3, "total" : 60.00}');
    const totals = JSON.parse(await sql(`SELECT json_build_object('paid',total_paid_amount,
      'balance',outstanding_balance,'original',original_submitted_amount)
      FROM public.billing_records WHERE id='${record}'`));
    assert.deepEqual(totals, { paid: 60, balance: 40, original: 100 });
  } finally {
    await sql(`BEGIN;
      DELETE FROM public.billing_payment_allocations WHERE org_id='${org}';
      DELETE FROM public.billing_payments WHERE org_id='${org}';
      DELETE FROM public.billing_records WHERE org_id='${org}';
      DELETE FROM public.billing_payers WHERE org_id='${org}';
      DELETE FROM public.patients WHERE org_id='${org}';
      DELETE FROM public.organization_memberships WHERE org_id='${org}';
      DELETE FROM public.user_profiles WHERE user_id='${user}';
      DELETE FROM public.organizations WHERE id='${org}';
      DELETE FROM auth.users WHERE id='${user}';
      COMMIT;`);
  }
});
