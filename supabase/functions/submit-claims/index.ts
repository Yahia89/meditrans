import { createClient } from "https://esm.sh/@supabase/supabase-js@2.63.1";
import SFTPClient from "npm:ssh2-sftp-client@9.1.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Determine if we are processing a specific claim or all pending
    const body = await req.json().catch(() => ({}));
    const { claim_id } = body;

    let query = supabaseClient
      .from("billing_claims")
      .select(
        `
        *,
        organization:organizations(*)
      `,
      )
      .eq("status", "generated");

    if (claim_id) {
      query = query.eq("id", claim_id);
    } else {
      query = query.limit(10);
    }

    const { data: claims, error: claimsError } = await query;

    if (claimsError) throw claimsError;
    if (!claims || claims.length === 0) {
      return new Response(JSON.stringify({ message: "No claims to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const claim of claims) {
      const org = claim.organization;

      if (!org.sftp_enabled || !org.sftp_host) {
        results.push({
          claim_id: claim.id,
          status: "skipped",
          reason: "SFTP not configured or enabled for this organization",
        });
        continue;
      }

      const sftp = new SFTPClient();
      try {
        await sftp.connect({
          host: org.sftp_host,
          port: org.sftp_port || 22,
          username: org.sftp_username,
          password: org.sftp_password_enc,
          readyTimeout: 10000,
        });

        const filename =
          claim.generated_file_name || `${claim.claim_control_number}_837P.txt`;
        const remotePath = `/inbound/${filename}`;

        const fileBuffer = new TextEncoder().encode(
          claim.generated_file_data || "",
        );

        await sftp.put(fileBuffer, remotePath);
        await sftp.end();

        const { error: updateError } = await supabaseClient
          .from("billing_claims")
          .update({
            status: "submitted",
            submitted_at: new Date().toISOString(),
          })
          .eq("id", claim.id);

        if (updateError) throw updateError;

        results.push({
          claim_id: claim.id,
          status: "submitted",
          filename,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`SFTP Upload Error for batch ${claim.id}:`, message);
        results.push({
          claim_id: claim.id,
          status: "error",
          error: message,
        });
      } finally {
        try {
          await sftp.end();
        } catch (_e) {
          /* ignore */
        }
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Function Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
