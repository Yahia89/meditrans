import { createClient } from "https://esm.sh/@supabase/supabase-js@2.63.1";
import SFTPClient from "npm:ssh2-sftp-client@9.1.0";

interface EDIClaimResponse {
  claimId: string;
  status: string;
  paidAmount: number;
  totalCharge: number;
  denialReason?: string;
}

function parseX12(content: string) {
  const segments = content
    .split("~")
    .map((s) => s.trim())
    .filter(Boolean);
  return segments.map((seg) => seg.split("*"));
}

function parse999(content: string) {
  const segments = parseX12(content);
  let status = "rejected";
  let controlNumber = "";

  segments.forEach((seg) => {
    if (seg[0] === "AK1") controlNumber = seg[2];
    if (seg[0] === "AK9") {
      status = seg[1] === "A" || seg[1] === "E" ? "accepted" : "rejected";
    }
  });

  return { type: "999", status, controlNumber };
}

function parse835(content: string) {
  const segments = parseX12(content);
  const claims: EDIClaimResponse[] = [];
  let currentClaim: EDIClaimResponse | null = null;

  segments.forEach((seg) => {
    if (seg[0] === "CLP") {
      if (currentClaim) claims.push(currentClaim);
      currentClaim = {
        claimId: seg[1],
        status: seg[2],
        paidAmount: parseFloat(seg[4]),
        totalCharge: parseFloat(seg[3]),
      };
    }
    if (seg[0] === "CAS" && currentClaim) {
      currentClaim.denialReason = `${seg[2]}: ${seg[3]}`;
    }
  });
  if (currentClaim) claims.push(currentClaim);
  return { type: "835", claims };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: orgs, error: orgsError } = await supabaseClient
      .from("organizations")
      .select("*")
      .eq("sftp_enabled", true);

    if (orgsError) throw orgsError;

    const summary = [];

    for (const org of orgs || []) {
      const sftp = new SFTPClient();
      try {
        await sftp.connect({
          host: org.sftp_host,
          port: org.sftp_port || 22,
          username: org.sftp_username,
          password: org.sftp_password_enc,
          readyTimeout: 15000,
        });

        const list = await sftp.list("/outbound");
        const processedFiles = [];

        for (const file of list) {
          if (file.type === "d") continue;

          const content = await sftp.get(`/outbound/${file.name}`, false);
          const rawText = new TextDecoder().decode(content as Uint8Array);

          let parsed;
          if (rawText.includes("AK1*")) {
            parsed = parse999(rawText);
            await supabaseClient
              .from("billing_claims")
              .update({
                response_status: parsed.status,
                status: parsed.status === "accepted" ? "ready" : "rejected",
              })
              .eq("claim_control_number", parsed.controlNumber);
          } else if (rawText.includes("CLP*")) {
            parsed = parse835(rawText);
            for (const c of parsed.claims) {
              await supabaseClient
                .from("billing_claims")
                .update({
                  status: c.status === "1" ? "paid" : "rejected",
                  response_status: c.status === "1" ? "Paid" : "Denied",
                  response_data: c,
                })
                .eq("claim_control_number", c.claimId);
            }
          }

          await supabaseClient.from("billing_response_logs").insert({
            org_id: org.id,
            file_name: file.name,
            file_type: rawText.includes("AK1*") ? "999" : "835",
            raw_content: rawText,
            status: "processed",
            metadata: parsed,
          });

          processedFiles.push(file.name);
        }

        summary.push({ org: org.name, files: processedFiles });
      } catch (err: unknown) {
        summary.push({
          org: org.name,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        try {
          await sftp.end();
        } catch (_e) {
          /* ignore */
        }
      }
    }

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
