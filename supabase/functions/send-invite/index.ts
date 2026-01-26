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
    const isOwnerInvite = record.role === "owner";
    const inviteUrl = `${SITE_URL}?page=accept-invite&token=${record.token}`;

    const theme = {
      primary: "#3D5A3D",
      primaryHover: "#2E4A2E",
      text: "#0f172a",
      textMuted: "#64748b",
      bg: "#f8fafc",
      card: "#ffffff",
      border: "#e2e8f0",
    };

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
          <title>${isOwnerInvite ? "Welcome to Future NEMT" : `Join ${org.name}`}</title>
          <style>
            @media only screen and (max-width: 620px) {
              .container { width: 100% !important; padding: 20px 10px !important; }
              .content { padding: 32px 20px !important; }
              .title { font-size: 24px !important; }
            }
          </style>
        </head>
        <body style="background-color: ${theme.bg}; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
          <table border="0" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; background-color: ${theme.bg};">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table border="0" cellpadding="0" cellspacing="0" class="container" style="width: 100%; max-width: 600px; border-collapse: collapse;">
                  <tr>
                    <td style="background: ${theme.card}; border-radius: 24px; border: 1px solid ${theme.border}; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">
                      <!-- Header Accent -->
                      <div style="height: 4px; background-color: ${theme.primary};"></div>
                      
                      <div class="content" style="padding: 48px;">
                        <!-- Logo -->
                        <div style="margin-bottom: 32px; text-align: center;">
                          <div style="margin-bottom: 16px;">
                            <img src="${SITE_URL}logo_in_email.jpg" width="80" height="80" style="border-radius: 20px; object-fit: cover;" alt="Future NEMT Logo">
                          </div>
                          <div style="font-size: 14px; font-weight: 700; color: ${theme.primary}; letter-spacing: 0.1em; text-transform: uppercase;">
                            Future NEMT Platform
                          </div>
                        </div>

                        <h1 class="title" style="color: ${theme.text}; font-size: 30px; font-weight: 800; line-height: 1.25; margin: 0 0 16px 0; text-align: center; letter-spacing: -0.025em;">
                          ${isOwnerInvite ? "Your Digital Fleet Awaits." : "You're Invited."}
                        </h1>
                        
                        <p style="font-size: 16px; line-height: 1.6; color: ${theme.textMuted}; margin: 0 0 32px 0; text-align: center;">
                          ${
                            isOwnerInvite
                              ? `You are invited to the <strong>Future NEMT platform</strong> to manage your <strong>${org.name}</strong> fleet. Our suite of tools will help you streamline operations, track drivers in real-time, and automate billing.`
                              : `You have been invited to join <strong>${org.name}</strong> as a <strong>${record.role}</strong> to help manage their digital transportation fleet.`
                          }
                        </p>
                        
                        <!-- CTA Button -->
                        <div style="text-align: center; margin-bottom: 40px;">
                          <a href="${inviteUrl}" target="_blank" style="display: inline-block; color: #ffffff; background-color: ${theme.primary}; border-radius: 14px; font-size: 16px; font-weight: 600; text-decoration: none; padding: 18px 36px; box-shadow: 0 4px 6px -1px rgba(61, 90, 61, 0.2);">
                            ${isOwnerInvite ? "Get Started Now" : "Accept & Join Fleet"}
                          </a>
                        </div>
                        
                        <!-- Platform Highlights -->
                        <div style="background-color: ${theme.bg}; border-radius: 16px; padding: 24px; margin-bottom: 32px; border: 1px solid ${theme.border};">
                          <p style="font-size: 13px; font-weight: 700; color: ${theme.text}; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.05em;">What's inside:</p>
                          <table border="0" cellpadding="0" cellspacing="0" style="width: 100%;">
                            <tr>
                              <td style="padding-bottom: 8px; font-size: 14px; color: ${theme.textMuted};">
                                <span style="color: ${theme.primary}; margin-right: 8px;">•</span> Real-time Live Tracking
                              </td>
                            </tr>
                            <tr>
                              <td style="padding-bottom: 8px; font-size: 14px; color: ${theme.textMuted};">
                                <span style="color: ${theme.primary}; margin-right: 8px;">•</span> Automated Dispatching
                              </td>
                            </tr>
                            <tr>
                              <td style="font-size: 14px; color: ${theme.textMuted};">
                                <span style="color: ${theme.primary}; margin-right: 8px;">•</span> Medicaid Billing Integration
                              </td>
                            </tr>
                          </table>
                        </div>

                        <!-- Footer Info -->
                        <div style="border-top: 1px solid ${theme.border}; padding-top: 24px; text-align: center;">
                          <p style="font-size: 12px; color: ${theme.textMuted}; margin: 0;">
                            If you didn't expect this invitation, you can safely ignore this email.
                          </p>
                          <p style="font-size: 12px; color: ${theme.textMuted}; margin: 8px 0 0 0;">
                            Need help? <a href="mailto:support@futrans.us" style="color: ${theme.primary}; text-decoration: none; font-weight: 600;">Contact Support</a>
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                  
                  <tr>
                    <td style="padding: 32px 0; text-align: center;">
                      <p style="font-size: 12px; color: ${theme.textMuted}; margin: 0; letter-spacing: 0.01em;">
                        &copy; ${new Date().getFullYear()} Future Transport Platform. Built for excellence in NEMT.
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
        from: "Future NEMT <info@techdevprime.com>",
        to: [record.email],
        subject: isOwnerInvite
          ? `Welcome to Future NEMT - Setup ${org.name}`
          : `[Invite] Join ${org.name} on Future NEMT`,
        html: emailHtml,
      }),
    });

    const resData = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(resData));

    return new Response(JSON.stringify({ success: true, data: resData }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
