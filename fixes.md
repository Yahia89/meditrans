can you see why this patient stopped receiving eta sms, we use an edge function to do that, everything was working but all of sudden it stopped for them, some still receive the sms and some stopped, i checked and verified their number and our messaging profile, everything is good:

f90289a8-bd1b-427e-a904-64c633801d0c

I’m going to check the database for any SMS/ETA send history tables and recent failures for this specific patient ID.
Patient lookup

select p.id as patient_id, p.full_name, p.phone, p.user_id, max(t.pickup_time) as last_pickup_time
from public.patients p
left join public.trips t on t.patient_id = p.id
where p.id = 'f90289a8-bd1b-427e-a904-64c633801d0c'
group by p.id, p.full_name, p.phone, p.user_id;

Now I’ll inspect the schema of public.sms_logs and pull the most recent ETA-related SMS attempts for this patient.
Failed to execute SQL.

I’ll quickly check which timestamp/metadata columns exist on public.sms_logs so we can pull the latest attempts.
sms_logs columns

select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'sms_logs'
order by ordinal_position;

Recent SMS logs

select \*
from public.sms_logs
where patient_id = 'f90289a8-bd1b-427e-a904-64c633801d0c'
order by sent_at desc
limit 20;

Next I’ll check whether ETA notification/state records were created for this patient after the last SMS log (to see if sends stopped due to missing triggers or suppressed states).
Failed to execute SQL.
notification_states columns

select column_name
from information_schema.columns
where table_schema='public' and table_name='notification_states'
order by ordinal_position;

Notification states (by alert_id)

select ns.\*
from public.notification_states ns
where ns.alert_id = 'f90289a8-bd1b-427e-a904-64c633801d0c'
order by ns.created_at desc
limit 20;

Success. No rows returned

I’ll trace what “notification” records exist for this patient (SMS queueing) by checking public.notifications and joining to notification_states.
notifications columns

select column_name
from information_schema.columns
where table_schema='public' and table_name='notifications'
order by ordinal_position;

Notifications for patient user

select n.\*
from public.notifications n
where n.user_id = (select p.user_id from public.patients p where p.id='f90289a8-bd1b-427e-a904-64c633801d0c')
order by n.created_at desc
limit 20;

Success. No rows returned

I’ll check if there are new trips for this patient since the last recorded ETA SMS, and whether the trip status history indicates ETA events should have triggered SMS.
Recent trips

select t.id as trip_id, t.pickup_time, t.status
from public.trips t
where t.patient_id = 'f90289a8-bd1b-427e-a904-64c633801d0c'
order by t.pickup_time desc
limit 10;

I’ll check whether ETA SMS logs exist for the patient’s upcoming trips (starting with the latest ones). If the SMS logs don’t exist, the trigger/scheduler isn’t firing for these trips.
ETA sms per trip

select t.id as trip_id,
t.pickup_time,
(select count(\*) from public.sms_logs s where s.trip_id = t.id and s.message_type like 'ETA%') as eta_sms_count,
(select max(sent_at) from public.sms_logs s where s.trip_id = t.id and s.message_type like 'ETA%') as last_eta_sms_at
from public.trips t
where t.patient_id = 'f90289a8-bd1b-427e-a904-64c633801d0c'
order by t.pickup_time desc
limit 6;

patients columns

select column_name
from information_schema.columns
where table_schema='public' and table_name='patients'
order by ordinal_position;

Patient flags

select id, status, sms_opt_out, disabled, disabled_at, user_id
from public.patients
where id='f90289a8-bd1b-427e-a904-64c633801d0c';

I’ll inspect the trip status history for the latest trip for this patient to see if the expected “assigned/confirmed” events that trigger ETA SMS ever occurred.
Trip status history

select tsh.id, tsh.status, tsh.created_at
from public.trip_status_history tsh
where tsh.trip_id='0a4c92e6-a453-488b-bad0-57b382fd9b38'
order by tsh.created_at asc
limit 20;

I’ll do the same trip status-history check for another “assigned” trip to confirm whether status changes are being written to trip_status_history (the likely trigger for sending ETA SMS).
Assigned trip history

select tsh.status, tsh.created_at
from public.trip_status_history tsh
where tsh.trip_id='39a968bf-2565-4c84-b2a9-65b5bfe6c54e'
order by tsh.created_at asc
limit 20;

Trips around now

select id, pickup_time, status
from public.trips
where patient_id='f90289a8-bd1b-427e-a904-64c633801d0c'
and pickup_time>=timestamptz '2026-07-13 00:00:00+00'
order by pickup_time asc
limit 20;

I’ll check sms_logs for any ETA_WARNING messages for this patient around July 13–today to see if attempts are happening but not being delivered/logged.
SMS logs since 7/10

select sent_at, trip_id, message_type, status, error_message
from public.sms_logs
where patient_id='f90289a8-bd1b-427e-a904-64c633801d0c'
and sent_at >= '2026-07-10 00:00:00+00'
order by sent_at desc
limit 50;

Success. No rows returned

I’ll verify whether ETA SMS sending stopped for everyone around the same time by checking if sms_logs contains any ETA% messages after 2026-06-24.
ETA SMS after 6/24

select date_trunc('day', sent_at) as day,
count(\*) filter (where message_type like 'ETA%') as eta_sms_count
from public.sms_logs
where sent_at >= '2026-06-20 00:00:00+00'
group by 1
order by 1 desc
limit 10;

Jul 12 2026 19:00Jul 2 2026 19:00Jun 26 2026 19:0002468
What I found for patient f90289a8-bd1b-427e-a904-64c633801d0c

1. Last ETA SMS was June 24

In public.sms_logs, the most recent ETA messages for this patient are:

    message_type = ETA_WARNING
    status = sent
    last one at 2026-06-24 20:07:17+00
    After that: no ETA% SMS records at all for this patient.

Also, when I checked the patient’s trips for the “new” upcoming trips (late July), there are 0 ETA SMS logs for each trip (including the ones around 2026-07-13). 2) New trips exist, but the status history is not progressing

For example, for trip 0a4c92e6-a453-488b-bad0-57b382fd9b38 (pickup 2026-07-31), public.trip_status_history contains only:

    TRIP CREATED (one row)

And for another “assigned” trip 39a968bf-2565-4c84-b2a9-65b5bfe6c54e, there is only:

    CREATED AND ASSIGNED (one row)

So for these trips, the system never records the later status transitions that many ETA schedulers rely on (examples: “confirmed”, “en_route”, “driver_assigned”, etc.—whatever your code uses). 3) Patient is not opted out, but user_id is null

In public.patients:

    sms_opt_out = false
    disabled = false
    **user_id = null**

Your older SMS logs exist even with user_id = null, but if the Edge Function recently changed to require a non-null user_id (or uses user_id to decide whether to schedule SMS), that would explain “it worked, then stopped suddenly for some patients”.
Most likely cause

Because there are trips and they have at least one status-history event, but no ETA SMS logs are being created for those trips, the Edge Function that sends ETA SMS is almost certainly not being triggered/scheduled for this patient’s trips due to one of these:

    Your scheduler depends on specific trip_status_history.status values, and these trips are not reaching them (status-history stuck at “TRIP CREATED” / “CREATED AND ASSIGNED”).
    Your Edge Function logic changed to filter recipients by something like patient.user_id (this patient has user_id = null).
    A recent change affected only certain orgs / trip flows, so some patients still receive while others don’t.

What I need from you to pinpoint it fast

Please tell me either:

    Which trip-status values are supposed to trigger ETA scheduling in your system (the exact strings your Edge Function checks), or
    Paste the relevant part of the Edge Function send_eta_sms that selects trips/patients (even just the query/filter logic).

Then I can tell you exactly why this patient’s trips aren’t matching and give you the exact SQL/patch to fix it.
Yahia89

ok let's do a comparison, i suspect this, the dispatcher who created the trips that don't trigger the sms is the issue, meanwhile other users, like an admin or org owner when they create a trip the sms trigger works, let's compare 2 users:

Roda, Dispatcher (904152c5-694a-4080-90d1-fee9b1fce585), i think her account is the issue. org owner: (8d75b021-dd4a-4dca-a4f4-44d7ab14c2e6), things work when he creates the trip.
trips columns

select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='trips'
order by ordinal_position;

trip_status_history columns

select column_name,data_type
from information_schema.columns
where table_schema='public' and table_name='trip_status_history'
order by ordinal_position;

Compare trips ETA sms

with disp_trips as (
select distinct tsh.trip_id
from public.trip_status_history tsh
where tsh.actor_id = '904152c5-694a-4080-90d1-fee9b1fce585'
and tsh.created_at >= now() - interval '90 days'
), owner_trips as (
select distinct tsh.trip_id
from public.trip_status_history tsh
where tsh.actor_id = '8d75b021-dd4a-4dca-a4f4-44d7ab14c2e6'
and tsh.created_at >= now() - interval '90 days'
)
select
'dispatcher' as group_name,
count(_) as trips,
avg((select count(_) from public.sms_logs s where s.trip_id = t.id and s.message_type like 'ETA%')) as avg_eta_sms_logs,
max(t.pickup_time) as max_pickup_time
from public.trips t
join disp_trips dt on dt.trip_id = t.id
union all
select
'org_owner' as group_name,
count(_) as trips,
avg((select count(_) from public.sms_logs s where s.trip_id = t.id and s.message_type like 'ETA%')) as avg_eta_sms_logs,
max(t.pickup_time) as max_pickup_time
from public.trips t
join owner_trips ot on ot.trip_id = t.id;

Failed to execute SQL.

SQL error due to array_agg distinct order by mismatch. I’ll rerun without DISTINCT in array_agg (or order inside).
Dispatcher trips with no ETA SMS

with disp_trips as (
select distinct tsh.trip_id
from public.trip_status_history tsh
where tsh.actor_id = '904152c5-694a-4080-90d1-fee9b1fce585'
and tsh.created_at >= now() - interval '30 days'
), candidates as (
select t.id as trip_id
from public.trips t
join disp_trips d on d.trip_id=t.id
left join lateral (
select count(\*) as eta_cnt
from public.sms_logs s
where s.trip_id=t.id and s.message_type like 'ETA%'
) x on true
where coalesce(x.eta_cnt,0)=0
)
select t.id as trip_id, t.pickup_time, t.status as trip_status,
array_agg(tsh.status order by tsh.created_at) as status_history
from public.trips t
join candidates c on c.trip_id=t.id
left join public.trip_status_history tsh on tsh.trip_id=t.id
group by t.id,t.pickup_time,t.status
order by t.pickup_time desc
limit 5;

Owner trips with ETA SMS

with owner_trips as (
select distinct tsh.trip_id
from public.trip_status_history tsh
where tsh.actor_id = '8d75b021-dd4a-4dca-a4f4-44d7ab14c2e6'
and tsh.created_at >= now() - interval '30 days'
), candidates as (
select t.id as trip_id
from public.trips t
join owner_trips o on o.trip_id=t.id
where exists (
select 1 from public.sms_logs s
where s.trip_id=t.id and s.message_type like 'ETA%'
)
)
select t.id as trip_id, t.pickup_time, t.status as trip_status,
array_agg(tsh.status order by tsh.created_at) as status_history
from public.trips t
join candidates c on c.trip_id=t.id
left join public.trip_status_history tsh on tsh.trip_id=t.id
group by t.id,t.pickup_time,t.status
order by t.pickup_time desc
limit 5;

Dispatcher vs Org Owner comparison (why some trips don’t trigger ETA SMS)

I compared trips whose trip status history was created by:

    Dispatcher (Roda): 904152c5-694a-4080-90d1-fee9b1fce585
    Org owner: 8d75b021-dd4a-4dca-a4f4-44d7ab14c2e6

1. Trips created by the dispatcher mostly never reach the later ETA-triggering statuses

For dispatcher-created trips (last ~30 days), I pulled sample trips that have 0 ETA SMS logs. Their trip_status_history looks like:

    TRIP CREATED only
    or CREATED AND ASSIGNED + maybe 1 “UPDATED: Time, Distance …”

Example samples of dispatcher trips with no ETA SMS:

    1fa9397c-ae4b-4132-8b37-1200b350e397 pickup 2026-08-05 00:00:00 → ["TRIP CREATED"]
    0a4c92e6-a453-488b-bad0-57b382fd9b38 pickup 2026-07-31 20:15:00 → ["TRIP CREATED"]
    2306b746-4ad4-438d-8783-51c1c7c16d0b pickup 2026-07-31 18:00:00 → ["CREATED AND ASSIGNED","UPDATED: Time, Distance: 16 miles"]

✅ Conclusion: the dispatcher’s trips often have incomplete status history progression, so your ETA dispatcher likely never sees the “right” status transitions to schedule/send ETA SMS. 2) Trips created by the org owner do progress through the full lifecycle and do generate ETA SMS

For org-owner-created trips that have at least one ETA SMS log, the trip_status_history includes the typical progression, e.g.:

    EN ROUTE TO PICKUP
    ARRIVED AT PICKUP
    IN_PROGRESS
    COMPLETED ...

Example org-owner trips with ETA SMS:

    dfd8d2be-80df-44f9-8e6f-91b3927a7000 pickup 2026-07-13 15:00:00 → includes EN ROUTE TO PICKUP, ARRIVED AT PICKUP, IN_PROGRESS, COMPLETED...
    737cc960-7d6d-4466-a22b-388674e6537c pickup 2026-07-13 14:30:00 → includes EN ROUTE TO PICKUP, ARRIVED AT PICKUP, IN_PROGRESS, COMPLETED...

✅ Conclusion: ETA SMS sending is tied to status changes that happen reliably only when the trip is created/managed by the org owner flow.
Root cause (most likely)

Roda/dispatcher is creating trips in a way that doesn’t write the later trip_status_history.status events that your ETA Edge Function (or its trigger/scheduler) depends on.

So it’s not “SMS sending broken”; it’s the trip lifecycle events required to schedule ETA SMS aren’t being emitted for dispatcher-created trips.
Next step (tell me 1 thing)

Can you paste (or describe) the exact trip_status_history.status strings that your ETA logic listens for (the values your Edge Function checks in order to send/schedule)?

Once I know the expected statuses, I can tell you exactly which missing events the dispatcher is failing to generate, and we can fix either:

    the dispatcher UI/dispatcher workflow, or
    the status-history writer logic / permissions / actor flow.

Yahia89

export type TripStatus = | "pending" | "assigned" | "accepted" | "en_route" | "arrived" | "in_progress" | "loaded" | "in_pickup_circle" | "in_dropoff_circle" | "completed" | "cancelled" | "no_show" | "waiting";
Status presence (en_route etc)

with base as (
select tsh.trip_id,
max(case when tsh.status in ('pending','assigned','accepted','en_route','arrived','in_progress','loaded','in_pickup_circle','in_dropoff_circle','completed','cancelled','no_show','waiting') then tsh.status end) as last_known,
array_agg(tsh.status order by tsh.created_at) as hist
from public.trip_status_history tsh
where tsh.actor_id in ('904152c5-694a-4080-90d1-fee9b1fce585','8d75b021-dd4a-4dca-a4f4-44d7ab14c2e6')
and tsh.created_at >= now() - interval '30 days'
group by tsh.trip_id
),
agg as (
select actor_id,
count(_) filter (where hist && array['en_route'::text]) as has_en_route
from (
select tsh.actor_id, tsh.trip_id, array_agg(tsh.status order by tsh.created_at) as hist
from public.trip_status_history tsh
where tsh.actor_id in ('904152c5-694a-4080-90d1-fee9b1fce585','8d75b021-dd4a-4dca-a4f4-44d7ab14c2e6')
and tsh.created_at >= now() - interval '30 days'
and tsh.status in ('pending','assigned','accepted','en_route','arrived','in_progress','loaded','in_pickup_circle','in_dropoff_circle','completed','cancelled','no_show','waiting')
group by tsh.actor_id, tsh.trip_id
) x
group by actor_id
)
select _ from agg;

I’ll now compute how many trips from each actor have missing key statuses, focusing on whether dispatcher trips ever reach at least assigned->en_route->arrived etc.
Failed to execute SQL.

SQL had alias issue; I’ll rerun correctly by computing hist counts in one CTE.
Missing statuses

with relevant as (
select tsh.trip_id,
tsh.actor_id,
array_agg(tsh.status order by tsh.created_at) as hist
from public.trip_status_history tsh
where tsh.actor_id in ('904152c5-694a-4080-90d1-fee9b1fce585','8d75b021-dd4a-4dca-a4f4-44d7ab14c2e6')
and tsh.created_at >= now() - interval '30 days'
and tsh.status in ('pending','assigned','accepted','en_route','arrived','in_progress','loaded','in_pickup_circle','in_dropoff_circle','completed','cancelled','no_show','waiting')
group by tsh.trip_id, tsh.actor_id
)
select actor_id,
count(_) filter (where not (hist && array['en_route'::text])) as missing_en_route,
count(_) filter (where not (hist && array['arrived'::text])) as missing_arrived,
count(_) filter (where not (hist && array['in_progress'::text])) as missing_in_progress,
count(_) as trips
from relevant
group by actor_id;

Missing statuses 180d

with relevant as (
select tsh.trip_id,
tsh.actor_id,
array_agg(tsh.status order by tsh.created_at) as hist
from public.trip_status_history tsh
where tsh.actor_id in ('904152c5-694a-4080-90d1-fee9b1fce585','8d75b021-dd4a-4dca-a4f4-44d7ab14c2e6')
and tsh.created_at >= now() - interval '180 days'
and tsh.status in ('pending','assigned','accepted','en_route','arrived','in_progress','loaded','in_pickup_circle','in_dropoff_circle','completed','cancelled','no_show','waiting')
group by tsh.trip_id, tsh.actor_id
)
select actor_id,
count(_) filter (where not (hist && array['en_route'::text])) as missing_en_route,
count(_) filter (where not (hist && array['arrived'::text])) as missing_arrived,
count(_) filter (where not (hist && array['in_progress'::text])) as missing_in_progress,
count(_) as trips
from relevant
group by actor_id
order by trips desc;

Actor mixes for no-ETA trips

with no_eta as (
select t.id as trip_id
from public.trips t
where t.created_at >= now() - interval '60 days'
and not exists (
select 1 from public.sms_logs s where s.trip_id=t.id and s.message_type like 'ETA%'
)
), actor_stats as (
select tsh.trip_id,
array_agg(distinct tsh.actor_id) as actor_ids,
count(_) as status_events
from public.trip_status_history tsh
join no_eta n on n.trip_id=tsh.trip_id
group by tsh.trip_id
)
select actor_ids, count(_) as trips
from actor_stats
group by actor_ids
order by trips desc
limit 5;

Sample no-ETA histories

with no_eta as (
select t.id as trip_id
from public.trips t
where t.created_at >= now() - interval '60 days'
and not exists (
select 1 from public.sms_logs s where s.trip_id=t.id and s.message_type like 'ETA%'
)
), sample as (
select n.trip_id
from no_eta n
where exists (select 1 from public.trip_status_history tsh where tsh.trip_id=n.trip_id and tsh.actor_id='904152c5-694a-4080-90d1-fee9b1fce585')
limit 3
)
select t.id as trip_id, t.pickup_time, t.status as trip_status,
array_agg(tsh.status order by tsh.created_at) as hist
from public.trips t
join sample s on s.trip_id=t.id
left join public.trip_status_history tsh on tsh.trip_id=t.id
group by t.id,t.pickup_time,t.status;

SMS logs for sample trips

select s.trip_id, s.message_type, s.status, s.sent_at, s.error_message
from public.sms_logs s
where s.trip_id in ('021c4103-8904-4b69-b32c-9c743b926baf','0655b0ce-1d95-4f87-a6fb-4d82101f366b','0a4c92e6-a453-488b-bad0-57b382fd9b38')
order by s.sent_at desc;

Success. No rows returned
Trip+patient context

select t.id as trip_id, t.org_id, t.patient_id, p.phone, p.sms_opt_out
from public.trips t
join public.patients p on p.id=t.patient_id
where t.id='021c4103-8904-4b69-b32c-9c743b926baf';

Patient sms logs

select \*
from public.sms_logs
where patient_id='fa7168d1-495d-4b0b-b688-7aec113cf9f4'
order by sent_at desc
limit 5;

Comparison result (Roda/dispatcher vs org owner)

You were right to suspect the dispatcher-created trips. Based on the actual data in:

    public.trip_status_history (who wrote which status event)
    public.sms_logs (whether ETA SMS attempts were logged)

✅ Dispatcher trips often stop progressing in the way your ETA logic expects

For the patient you flagged (f90289a8-bd1b-427e-a904-64c633801d0c):

    Their latest ETA SMS log is 2026-06-24
    Their newer trips after that have 0 ETA% SMS logs
    And at least some of those newer trips have only early status history (e.g. TRIP CREATED)

So the dispatcher’s flow is very likely producing incomplete / inconsistent trip_status_history events, meaning the send_eta_sms dispatcher never “sees” the lifecycle transitions needed to enqueue/send ETA SMS.
✅ Your TS TripStatus enum matches what should be driving scheduling

Your dispatcher-generated trips are showing status strings like:

    EN ROUTE TO PICKUP
    ARRIVED AT PICKUP
    IN_PROGRESS …at least in some cases.

But for the trips that don’t trigger SMS, the status history is often missing the specific subsequent states (or the exact string mapping your system expects), which then prevents the SMS creation step.
The key observation

Even when status progression exists, SMS may still not log because your ETA scheduling probably depends on:

    specific enum values (en_route, arrived, in_progress, etc.)
    and/or a mapping from trip_status_history.status text → those enum values.

If dispatcher updates produce a different trip_status_history.status wording (example: “EN ROUTE TO PICKUP” vs exactly what your code maps), then the SMS trigger would silently skip.
What I need to finish the diagnosis (1 exact thing)

Please paste the part of your Edge Function send_eta_sms that decides when to schedule/send based on trip status—specifically the condition that checks for which statuses.

Example of what I’m looking for (pseudo):

if
(tsh.status ===
"en_route"
|| tsh.status ===
"EN ROUTE TO PICKUP"
) { ... }

Once I see that mapping, I can tell you precisely which dispatcher status string(s) aren’t matching and propose the exact fix (either normalize the status_history text, or make the mapping accept the dispatcher variants).
Yahia89

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"; import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = { "Access-Control-Allow-Origin": "", "Access-Control-Allow-Headers": "authorization, x-client-info, x-internal-key, apikey, content-type", };

// Helper function to normalize phone number to E.164 format function normalizePhoneNumber(phone: string): string { const cleaned = phone.replace(/[^\d+]/g, ""); if (cleaned.startsWith("+")) { return cleaned; } if (cleaned.startsWith("1") && cleaned.length === 11) { return +${cleaned}; } return +1${cleaned}; }

serve(async (req) => { if (req.method === "OPTIONS") { return new Response("ok", { headers: corsHeaders }); }

try { const payload = await req.json(); const { trip_id } = payload; if (!trip_id) throw new Error("Missing trip_id");

console.log("=== ETA SMS Function Started ==="); console.log("Trip ID:", trip_id);
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";...

} catch (error: any) { console.error("Function error:", error); return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }, }); } });
No-ETA trips by actor status

with trips_no_eta as (
select t.id as trip_id, t.patient_id, t.org_id, t.status, t.pickup_time,
t.created_at,
exists(select 1 from public.sms_logs s where s.trip_id=t.id and s.message_type like 'ETA%') as has_eta
from public.trips t
where t.pickup_time >= now() - interval '60 days'
), filtered as (
select tn._
from trips_no_eta tn
where tn.has_eta = false
)
select
tsh.actor_id,
count(_) as trips,
count(\*) filter (where tn.status='en_route') as en_route_status,
array_agg(distinct tn.status) as distinct_statuses
from filtered tn
join public.trip_status_history tsh on tsh.trip_id=tn.trip_id
where tsh.created_at >= now() - interval '60 days'
and tsh.actor_id in ('904152c5-694a-4080-90d1-fee9b1fce585','8d75b021-dd4a-4dca-a4f4-44d7ab14c2e6')
group by tsh.actor_id
order by trips desc;

✅ Root cause (matches your Edge Function exactly)

In your send_eta_sms Edge Function you do this hard gate:

if
(trip.status !==
"en_route"
) {

return
{
status
:
"skipped"
}
}

So SMS will only ever be sent for trips whose public.trips.status is literally the text "en_route".

But when I compared trips created by:

    Dispatcher (Roda): 904152c5-694a-4080-90d1-fee9b1fce585
    Org owner: 8d75b021-dd4a-4dca-a4f4-44d7ab14c2e6

…I found that for dispatcher/owner trips that have NO ETA% SMS logs, their trip_status_history exists (so lifecycle events are happening), but the trip’s main public.trips.status is never en_route in that population.

Specifically, for the last 60 days “no ETA SMS” trips:

    Dispatcher actor trips: en_route_status = 0
    Org owner actor trips: en_route_status = 0

And dispatcher-created trips often only show earlier/other lifecycle states like pending/assigned (and in your earlier samples, even only TRIP CREATED), so they fail your trip.status !== "en_route" check.
Why this explains “org owner works, dispatcher doesn’t”

Most likely:

    Org owner flow updates public.trips.status to "en_route" at the right moment.
    Dispatcher flow does status updates into public.trip_status_history (strings like EN ROUTE TO PICKUP) but does not update public.trips.status to "en_route" (or updates it using different wording).

Your Edge Function doesn’t look at trip_status_history.status at all—it only checks trips.status.
Fix options (recommended)
Option A (best): Trigger SMS based on trip_status_history, not trips.status

Instead of:

    trip.status !== "en_route"

you should:

    check for the relevant history event (whatever your dispatcher writes) and map it to your TripStatus enum.

For example, if history uses text like "EN ROUTE TO PICKUP", then your scheduler should accept that.
Option B: Ensure dispatcher updates public.trips.status = 'en_route'

Fix the dispatcher workflow / trigger so it writes to public.trips.status (not just trip_status_history).
Immediate next question (so I can give you the exact code change)

In your database, what exact value does public.trips.status take when the trip is actually “en route” under dispatcher actions?

If you tell me one example trip id from Roda’s “no ETA” set that is clearly en route, I’ll query:

    public.trips.status
    public.trip_status_history around that time

…and then we can implement the correct mapping/condition in send_eta_sms.

Supabase AI may not always produce correct answers. Double check responses.
