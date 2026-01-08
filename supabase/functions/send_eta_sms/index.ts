import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { trip_id } = await req.json();
    if (!trip_id) throw new Error("Missing trip_id");

    // Init Supabase Client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch Trip Data with relations
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select(
        `
        *,
        driver:drivers!driver_id(id, current_lat, current_lng),
        patient:patients!patient_id(id, phone, sms_opt_out),
        organization:organizations!org_id(sms_notifications_enabled)
      `
      )
      .eq("id", trip_id)
      .single();

    if (tripError || !trip)
      throw new Error("Trip not found or error fetching data");

    // 2. Validation Checks
    if (!trip.organization?.sms_notifications_enabled) {
      return new Response(
        JSON.stringify({ status: "skipped", reason: "Org SMS disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (trip.patient?.sms_opt_out) {
      return new Response(
        JSON.stringify({ status: "skipped", reason: "Patient opted out" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (trip.status !== "in_progress") {
      return new Response(
        JSON.stringify({ status: "skipped", reason: "Trip not in progress" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (trip.eta_sms_sent_at) {
      return new Response(
        JSON.stringify({ status: "skipped", reason: "SMS already sent" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check driver location availability
    if (!trip.driver?.current_lat || !trip.driver?.current_lng) {
      return new Response(
        JSON.stringify({
          status: "skipped",
          reason: "No driver location available",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Calculate ETA with Google Maps Distance Matrix
    const googleApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!googleApiKey) {
      console.error("Missing Google Maps API Key");
      throw new Error("Configuration Error");
    }

    const origin = `${trip.driver.current_lat},${trip.driver.current_lng}`;
    const destination = trip.pickup_location; // Assuming accessible address

    const mapsUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
      origin
    )}&destinations=${encodeURIComponent(destination)}&key=${googleApiKey}`;

    const mapsRes = await fetch(mapsUrl);
    const mapsData = await mapsRes.json();

    // Validate Maps Response
    if (mapsData.status !== "OK" || !mapsData.rows[0]?.elements[0]?.duration) {
      console.error("Maps API Error", JSON.stringify(mapsData));
      // Fallback or error? For now, prevent crash but don't send SMS
      return new Response(
        JSON.stringify({ status: "error", reason: "Could not calculate ETA" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const durationSeconds = mapsData.rows[0].elements[0].duration.value;
    const durationMinutes = Math.ceil(durationSeconds / 60);

    // 4. Send SMS if ETA <= 5 minutes
    if (durationMinutes <= 5) {
      const telnyxApiKey = Deno.env.get("TELNYX_API_KEY");
      const telnyxFrom = Deno.env.get("TELNYX_FROM_NUMBER");

      if (!telnyxApiKey || !telnyxFrom) {
        console.error("Missing Telnyx Configuration");
        throw new Error("Configuration Error");
      }

      const messageBody =
        "Meditrans: Your driver is about 5 minutes away for your scheduled pickup. Reply STOP to opt out.";

      const smsRes = await fetch("https://api.telnyx.com/v2/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${telnyxApiKey}`,
        },
        body: JSON.stringify({
          from: telnyxFrom,
          to: trip.patient.phone,
          text: messageBody,
        }),
      });

      const smsData = await smsRes.json();

      // 5. Log & Update
      if (smsRes.ok) {
        // Mark trip as notified
        await supabase
          .from("trips")
          .update({ eta_sms_sent_at: new Date().toISOString() })
          .eq("id", trip_id);

        // Log to sms_logs
        await supabase.from("sms_logs").insert({
          org_id: trip.org_id,
          trip_id: trip.id,
          patient_id: trip.patient_id,
          phone_number: trip.patient.phone,
          message_type: "ETA_WARNING",
          status: "sent",
          provider_id: smsData.data?.id,
        });

        return new Response(
          JSON.stringify({ status: "sent", eta_minutes: durationMinutes }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        console.error("Telnyx Error", smsData);
        await supabase.from("sms_logs").insert({
          org_id: trip.org_id,
          trip_id: trip.id,
          patient_id: trip.patient_id,
          phone_number: trip.patient.phone,
          message_type: "ETA_WARNING",
          status: "failed",
          error_message: JSON.stringify(smsData.errors || smsData),
        });
        throw new Error("Failed to send SMS via Telnyx");
      }
    }

    return new Response(
      JSON.stringify({
        status: "checked",
        eta_minutes: durationMinutes,
        message: "ETA > 5 mins, no SMS sent",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
