import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
// Force the base URL for GitHub Pages
const SITE_URL = 'https://yahiaalhejoj.github.io/meditrans/'

Deno.serve(async (req) => {
  try {
    const { record } = await req.json()
    
    if (!record) {
      throw new Error('No record found in request')
    }

    const supabase = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Fetch Organization Details
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', record.org_id)
      .single()

    if (orgError) throw orgError

    // 2. Prepare Email Content
    // Use the ?page= syntax for nuqs routing
    const inviteUrl = `${SITE_URL}?page=accept-invite&token=${record.token}`
    
    const emailHtml = `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; color: #334155; line-height: 1.6;">
        <div style="background-color: #3D5A3D; padding: 32px 20px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">MediTrans CRM</h1>
        </div>
        <div style="padding: 40px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; background-color: #ffffff;">
          <h2 style="color: #0f172a; margin-top: 0; font-size: 24px;">Join the Team</h2>
          <p>You have been invited to join <strong>${org.name}</strong> as an <strong>${record.role.toUpperCase()}</strong>.</p>
          
          <div style="margin: 40px 0; text-align: center;">
            <a href="${inviteUrl}" 
               style="background-color: #3D5A3D; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          
          <p style="font-size: 14px; color: #64748b;">
            Trouble with the button? Copy this link:<br>
            <a href="${inviteUrl}" style="color: #3D5A3D;">${inviteUrl}</a>
          </p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 40px 0;">
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">
            &copy; ${new Date().getFullYear()} MediTrans CRM. 
          </p>
        </div>
      </div>
    `

    // 3. Send via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'MediTrans <info@techdevprime.com>',
        to: [record.email],
        subject: `[Invite] Join ${org.name}`,
        html: emailHtml,
      }),
    })

    const resData = await res.json()
    if (!res.ok) throw new Error(JSON.stringify(resData))

    return new Response(JSON.stringify({ success: true, data: resData }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
