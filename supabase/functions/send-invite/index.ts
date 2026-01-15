import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Use the custom domain for production
const SITE_URL = "https://nemt.futrans.us/";

Deno.serve(async (req) => {
  try {
    const { record } = await req.json();

    if (!record) {
      throw new Error("No record found in request");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // 1. Fetch Organization Details
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", record.org_id)
      .single();

    if (orgError) throw orgError;

    // 2. Prepare Email Content
    // Use the ?page= syntax for nuqs routing
    const inviteUrl = `${SITE_URL}?page=accept-invite&token=${record.token}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
          <title>Join ${org.name}</title>
          <style>
            @media only screen and (max-width: 620px) {
              table.body h1 {
                font-size: 26px !important;
                margin-bottom: 16px !important;
              }
              table.body .wrapper {
                padding: 32px 20px !important;
              }
              table.body .container {
                padding: 20px 10px !important;
                width: 100% !important;
              }
            }
          </style>
        </head>
        <body style="background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
          <table border="0" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #f8fafc;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table border="0" cellpadding="0" cellspacing="0" style="width: 100%; max-width: 580px;">
                  <tr>
                    <td style="background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                      <!-- Accent Bar -->
                      <div style="height: 6px; background-color: #0f172a;"></div>
                      
                      <div style="padding: 48px;">
                        <!-- Logo & Brand -->
                        <div style="margin-bottom: 40px;">
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <img src="https://api.iconify.design/ph:user-circle-plus-bold.svg?color=%230f172a" width="32" height="32" style="vertical-align: middle;" alt="icon">
                            <span style="font-size: 20px; font-weight: 800; letter-spacing: -0.025em; color: #0f172a; margin-left: 8px; vertical-align: middle;">MEDITRANS PRO</span>
                          </div>
                        </div>

                        <h1 style="color: #0f172a; font-size: 32px; font-weight: 700; line-height: 1.2; margin: 0 0 16px 0; letter-spacing: -0.05em;">You're Invited.</h1>
                        
                        <p style="font-size: 17px; line-height: 1.6; color: #475569; margin: 0 0 32px 0;">
                          <strong>${
                            org.name
                          }</strong> has invited you to join their digital fleet management platform as an <strong>${
      record.role
    }</strong>.
                        </p>
                        
                        <!-- CTA Button -->
                        <table border="0" cellpadding="0" cellspacing="0" style="width: auto; margin-bottom: 40px;">
                          <tr>
                            <td style="background-color: #0f172a; border-radius: 12px; text-align: center;"> 
                              <a href="${inviteUrl}" target="_blank" style="display: inline-block; color: #ffffff; background-color: #0f172a; border-radius: 12px; font-size: 16px; font-weight: 600; text-decoration: none; padding: 16px 32px;">
                                Accept Invitation
                              </a> 
                            </td>
                          </tr>
                        </table>
                        
                        <!-- Footer Info -->
                        <div style="border-top: 1px solid #f1f5f9; padding-top: 32px;">
                          <p style="font-size: 13px; color: #94a3b8; margin: 0 0 8px 0;">
                            If you didn't expect this, you can ignore this message.
                          </p>
                          <p style="font-size: 13px; color: #94a3b8; margin: 0;">
                            Button not working? Copy this link:<br>
                            <a href="${inviteUrl}" style="color: #64748b; text-decoration: underline;">${inviteUrl}</a>
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                  
                  <tr>
                    <td style="padding: 32px 0; text-align: center;">
                      <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                        &copy; ${new Date().getFullYear()} MediTrans CRM. Built for excellence in NEMT.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    // 3. Send via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "MediTrans <info@techdevprime.com>",
        to: [record.email],
        subject: `[Invite] Join ${org.name} on MediTrans`,
        html: emailHtml,
      }),
    });

    const resData = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(resData));

    return new Response(JSON.stringify({ success: true, data: resData }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
