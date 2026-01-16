import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Helper function to normalize phone number to E.164 format
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except the leading +
  const cleaned = phone.replace(/[^\d+]/g, "");
  // If it starts with +, keep it; otherwise add +1 for US numbers
  if (cleaned.startsWith("+")) {
    return cleaned;
  }
  // Handle US numbers that start with 1
  if (cleaned.startsWith("1") && cleaned.length === 11) {
    return `+${cleaned}`;
  }
  // Default: assume US number and prepend +1
  return `+1${cleaned}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { trip_id } = await req.json();
    if (!trip_id) throw new Error("Missing trip_id");

    console.log("=== ETA SMS Function Started ===");
    console.log("Trip ID:", trip_id);

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

    if (tripError || !trip) {
      console.error("Trip fetch error:", tripError);
      throw new Error("Trip not found or error fetching data");
    }

    console.log("Trip fetched successfully");
    console.log("Trip Status:", trip.status);
    console.log(
      "Org SMS Enabled:",
      trip.organization?.sms_notifications_enabled
    );
    console.log("Patient Phone (raw):", trip.patient?.phone);
    console.log("Patient Opt-Out:", trip.patient?.sms_opt_out);
    console.log("Already Sent At:", trip.eta_sms_sent_at);
    console.log("Driver Lat:", trip.driver?.current_lat);
    console.log("Driver Lng:", trip.driver?.current_lng);

    // 2. Validation Checks
    if (!trip.organization?.sms_notifications_enabled) {
      console.log("SKIPPED: Org SMS disabled");
      return new Response(
        JSON.stringify({ status: "skipped", reason: "Org SMS disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (trip.patient?.sms_opt_out) {
      console.log("SKIPPED: Patient opted out");
      return new Response(
        JSON.stringify({ status: "skipped", reason: "Patient opted out" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // Check for en_route status - this is when driver is on the way to pickup
    if (trip.status !== "en_route") {
      console.log("SKIPPED: Trip not en_route, current status:", trip.status);
      return new Response(
        JSON.stringify({
          status: "skipped",
          reason: `Trip not en_route (current: ${trip.status})`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (trip.eta_sms_sent_at) {
      console.log("SKIPPED: SMS already sent at", trip.eta_sms_sent_at);
      return new Response(
        JSON.stringify({ status: "skipped", reason: "SMS already sent" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check driver location availability
    if (!trip.driver?.current_lat || !trip.driver?.current_lng) {
      console.log("SKIPPED: No driver location");
      return new Response(
        JSON.stringify({
          status: "skipped",
          reason: "No driver location available",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("All validations passed, proceeding to ETA calculation");

    // 3. Calculate ETA with Google Maps Distance Matrix
    const googleApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!googleApiKey) {
      console.error("Missing Google Maps API Key");
      throw new Error("Configuration Error: Missing GOOGLE_MAPS_API_KEY");
    }

    const origin = `${trip.driver.current_lat},${trip.driver.current_lng}`;
    const destination = trip.pickup_location;

    console.log("Calculating ETA from:", origin, "to:", destination);

    const mapsUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
      origin
    )}&destinations=${encodeURIComponent(destination)}&key=${googleApiKey}`;

    const mapsRes = await fetch(mapsUrl);
    const mapsData = await mapsRes.json();

    console.log("Maps API Status:", mapsData.status);

    // Validate Maps Response
    if (mapsData.status !== "OK" || !mapsData.rows[0]?.elements[0]?.duration) {
      console.error("Maps API Error:", JSON.stringify(mapsData));
      return new Response(
        JSON.stringify({
          status: "error",
          reason: "Could not calculate ETA",
          mapsError: mapsData.status,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const durationSeconds = mapsData.rows[0].elements[0].duration.value;
    const durationMinutes = Math.ceil(durationSeconds / 60);

    console.log("ETA calculated:", durationMinutes, "minutes");

    // 4. Send SMS if ETA <= 5 minutes
    if (durationMinutes <= 5) {
      console.log("ETA <= 5 minutes, sending SMS");

      const telnyxApiKey = Deno.env.get("TELNYX_API_KEY");
      const telnyxFrom = Deno.env.get("TELNYX_FROM_NUMBER");

      if (!telnyxApiKey) {
        console.error("Missing TELNYX_API_KEY");
        throw new Error("Configuration Error: Missing TELNYX_API_KEY");
      }
      if (!telnyxFrom) {
        console.error("Missing TELNYX_FROM_NUMBER");
        throw new Error("Configuration Error: Missing TELNYX_FROM_NUMBER");
      }

      // Normalize phone number to E.164 format
      const normalizedPhone = normalizePhoneNumber(trip.patient.phone);
      console.log(
        "Phone normalized:",
        trip.patient.phone,
        "->",
        normalizedPhone
      );
      console.log("From number:", telnyxFrom);

      const messageBody =
        "Meditrans: Your driver is about 5 minutes away for your scheduled pickup. Reply STOP to opt out.";

      console.log("Calling Telnyx API...");

      const smsRes = await fetch("https://api.telnyx.com/v2/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${telnyxApiKey}`,
        },
        body: JSON.stringify({
          from: telnyxFrom,
          to: normalizedPhone,
          text: messageBody,
        }),
      });

      const smsData = await smsRes.json();

      console.log("Telnyx API Response Status:", smsRes.status);
      console.log("Telnyx API Response:", JSON.stringify(smsData));

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
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
