import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, x-internal-key, apikey, content-type",
};

type EtaCheckStatus =
  | "sent"
  | "checked_eta_too_far"
  | "skipped_org_disabled"
  | "skipped_patient_opted_out"
  | "skipped_not_en_route"
  | "skipped_already_sent"
  | "skipped_no_location"
  | "skipped_no_phone"
  | "skipped_unauthorized"
  | "skipped_trip_not_found"
  | "error_maps"
  | "error_telnyx"
  | "error_config"
  | "error_unhandled";

function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("1") && cleaned.length === 11) return `+${cleaned}`;
  return `+1${cleaned}`;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function logEtaCheck(
  supabase: any,
  params: {
    check_status: EtaCheckStatus;
    reason?: string;
    eta_minutes?: number | null;
    request_context?: Record<string, unknown>;
    trip?: any;
    trip_id?: string | null;
  },
): Promise<void> {
  const trip = params.trip;
  const { error } = await supabase.from("eta_sms_check_logs").insert({
    org_id: trip?.org_id ?? null,
    trip_id: trip?.id ?? params.trip_id ?? null,
    driver_id: trip?.driver_id ?? trip?.driver?.id ?? null,
    patient_id: trip?.patient_id ?? trip?.patient?.id ?? null,
    check_status: params.check_status,
    reason: params.reason ?? null,
    eta_minutes: params.eta_minutes ?? null,
    request_context: params.request_context ?? {},
  });

  if (error) {
    console.error("ETA check log insert failed:", error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let payload: Record<string, unknown> = {};
  let tripId: string | null = null;

  try {
    payload = await req.json();
    tripId = typeof payload.trip_id === "string" ? payload.trip_id : null;
    if (!tripId) throw new Error("Missing trip_id");

    const configuredInternalKey = Deno.env.get("INTERNAL_FUNCTION_KEY");
    const requestInternalKey = req.headers.get("x-internal-key");
    const hasValidInternalKey =
      !!configuredInternalKey && requestInternalKey === configuredInternalKey;
    let callerUserId: string | null = null;

    if (!hasValidInternalKey) {
      const authHeader = req.headers.get("Authorization");
      const token = authHeader?.replace("Bearer ", "").trim();

      if (!token) {
        await logEtaCheck(supabase, {
          check_status: "skipped_unauthorized",
          reason: "Missing Authorization header",
          trip_id: tripId,
          request_context: payload,
        });
        return jsonResponse({ status: "error", reason: "Unauthorized" }, 401);
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser(token);

      if (userError || !user) {
        await logEtaCheck(supabase, {
          check_status: "skipped_unauthorized",
          reason: "Invalid Authorization header",
          trip_id: tripId,
          request_context: payload,
        });
        return jsonResponse({ status: "error", reason: "Unauthorized" }, 401);
      }

      callerUserId = user.id;
    }

    console.log("=== ETA SMS Function Started ===");
    console.log("Trip ID:", tripId);

    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select(
        `
        *,
        driver:drivers!driver_id(id, user_id, current_lat, current_lng),
        patient:patients!patient_id(id, phone, sms_opt_out),
        organization:organizations!org_id(name, sms_notifications_enabled)
      `,
      )
      .eq("id", tripId)
      .single();

    if (tripError || !trip) {
      const reason = tripError?.message || "Trip not found";
      console.log("SKIPPED:", reason);
      await logEtaCheck(supabase, {
        check_status: "skipped_trip_not_found",
        reason,
        trip_id: tripId,
        request_context: payload,
      });
      return jsonResponse({ status: "skipped", reason });
    }

    if (callerUserId && trip.driver?.user_id !== callerUserId) {
      const { data: membership, error: membershipError } = await supabase
        .from("organization_memberships")
        .select("id")
        .eq("org_id", trip.org_id)
        .eq("user_id", callerUserId)
        .maybeSingle();

      if (membershipError || !membership) {
        const reason = membershipError?.message || "Caller is not in trip org";
        await logEtaCheck(supabase, {
          check_status: "skipped_unauthorized",
          reason,
          trip,
          request_context: payload,
        });
        return jsonResponse({ status: "error", reason: "Forbidden" }, 403);
      }
    }

    console.log("Trip fetched successfully", {
      status: trip.status,
      eta_sms_sent_at: trip.eta_sms_sent_at,
      driverLat: trip.driver?.current_lat,
      driverLng: trip.driver?.current_lng,
    });

    if (!trip.organization?.sms_notifications_enabled) {
      await logEtaCheck(supabase, {
        check_status: "skipped_org_disabled",
        reason: "Org SMS disabled",
        trip,
        request_context: payload,
      });
      return jsonResponse({ status: "skipped", reason: "Org SMS disabled" });
    }

    if (trip.patient?.sms_opt_out) {
      await logEtaCheck(supabase, {
        check_status: "skipped_patient_opted_out",
        reason: "Patient opted out",
        trip,
        request_context: payload,
      });
      return jsonResponse({ status: "skipped", reason: "Patient opted out" });
    }

    if (trip.status !== "en_route") {
      const reason = `Trip not en_route (current: ${trip.status})`;
      await logEtaCheck(supabase, {
        check_status: "skipped_not_en_route",
        reason,
        trip,
        request_context: payload,
      });
      return jsonResponse({ status: "skipped", reason });
    }

    if (trip.eta_sms_sent_at) {
      await logEtaCheck(supabase, {
        check_status: "skipped_already_sent",
        reason: "SMS already sent",
        trip,
        request_context: payload,
      });
      return jsonResponse({ status: "skipped", reason: "SMS already sent" });
    }

    if (!trip.patient?.phone) {
      await logEtaCheck(supabase, {
        check_status: "skipped_no_phone",
        reason: "Patient has no phone number",
        trip,
        request_context: payload,
      });
      return jsonResponse({
        status: "skipped",
        reason: "Patient has no phone number",
      });
    }

    if (!trip.driver?.current_lat || !trip.driver?.current_lng) {
      await logEtaCheck(supabase, {
        check_status: "skipped_no_location",
        reason: "No driver location available",
        trip,
        request_context: payload,
      });
      return jsonResponse({
        status: "skipped",
        reason: "No driver location available",
      });
    }

    const googleApiKey =
      Deno.env.get("GOOGLE_MAPS_SERVER_API_KEY") ||
      Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!googleApiKey) {
      await logEtaCheck(supabase, {
        check_status: "error_config",
        reason: "Missing Google Maps API key",
        trip,
        request_context: payload,
      });
      return jsonResponse(
        { status: "error", reason: "Missing Google Maps API key" },
        500,
      );
    }

    const origin = `${trip.driver.current_lat},${trip.driver.current_lng}`;
    const destination = trip.pickup_location;
    const mapsUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
      origin,
    )}&destinations=${encodeURIComponent(destination)}&key=${googleApiKey}`;

    const mapsRes = await fetch(mapsUrl);
    const mapsData = await mapsRes.json();
    const durationSeconds = mapsData.rows?.[0]?.elements?.[0]?.duration?.value;

    if (mapsData.status !== "OK" || typeof durationSeconds !== "number") {
      const reason = `Could not calculate ETA (Maps status: ${mapsData.status})`;
      console.error("Maps API Error:", JSON.stringify(mapsData));
      await logEtaCheck(supabase, {
        check_status: "error_maps",
        reason,
        trip,
        request_context: { ...payload, maps_status: mapsData.status },
      });
      return jsonResponse({
        status: "error",
        reason: "Could not calculate ETA",
        mapsError: mapsData.status,
      });
    }

    const durationMinutes = Math.ceil(durationSeconds / 60);
    console.log("ETA calculated:", durationMinutes, "minutes");

    if (durationMinutes > 5) {
      await logEtaCheck(supabase, {
        check_status: "checked_eta_too_far",
        reason: "ETA > 5 minutes",
        eta_minutes: durationMinutes,
        trip,
        request_context: payload,
      });
      return jsonResponse({
        status: "checked",
        eta_minutes: durationMinutes,
        message: "ETA > 5 mins, no SMS sent",
      });
    }

    const telnyxApiKey = Deno.env.get("TELNYX_API_KEY");
    const telnyxFrom = Deno.env.get("TELNYX_FROM_NUMBER");

    if (!telnyxApiKey || !telnyxFrom) {
      const reason = !telnyxApiKey
        ? "Missing TELNYX_API_KEY"
        : "Missing TELNYX_FROM_NUMBER";
      await logEtaCheck(supabase, {
        check_status: "error_config",
        reason,
        eta_minutes: durationMinutes,
        trip,
        request_context: payload,
      });
      return jsonResponse({ status: "error", reason }, 500);
    }

    const normalizedPhone = normalizePhoneNumber(trip.patient.phone);
    const messageBody = `${trip.organization?.name || "Future Transportation"}: Your driver is about 5 minutes away for your scheduled pickup. Reply STOP to opt out.`;

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

    if (!smsRes.ok) {
      const reason = JSON.stringify(smsData.errors || smsData);
      console.error("Telnyx Error", smsData);
      await supabase.from("sms_logs").insert({
        org_id: trip.org_id,
        trip_id: trip.id,
        patient_id: trip.patient_id,
        phone_number: trip.patient.phone,
        message_type: "ETA_WARNING",
        status: "failed",
        error_message: reason,
      });
      await logEtaCheck(supabase, {
        check_status: "error_telnyx",
        reason,
        eta_minutes: durationMinutes,
        trip,
        request_context: payload,
      });
      return jsonResponse({ status: "error", reason: "Telnyx send failed" }, 502);
    }

    await supabase
      .from("trips")
      .update({ eta_sms_sent_at: new Date().toISOString() })
      .eq("id", tripId);

    await supabase.from("sms_logs").insert({
      org_id: trip.org_id,
      trip_id: trip.id,
      patient_id: trip.patient_id,
      phone_number: trip.patient.phone,
      message_type: "ETA_WARNING",
      status: "sent",
      provider_id: smsData.data?.id,
    });

    await logEtaCheck(supabase, {
      check_status: "sent",
      reason: "ETA SMS sent",
      eta_minutes: durationMinutes,
      trip,
      request_context: payload,
    });

    return jsonResponse({ status: "sent", eta_minutes: durationMinutes });
  } catch (error) {
    const message = (error as Error).message;
    console.error("Function error:", error);
    if (tripId) {
      await logEtaCheck(supabase, {
        check_status: "error_unhandled",
        reason: message,
        trip_id: tripId,
        request_context: payload,
      });
    }
    return jsonResponse({ error: message }, 400);
  }
});
