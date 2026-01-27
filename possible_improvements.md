Nice — thanks for all the code, that made this easy to diagnose. You hit two separate but related problems:

1. **Too many Google Directions requests** (and possibly rate limits) — that will lock up the map renderer and slow the UI.
2. **Excessive React state churn** from updating every driver on every animation frame (or on every tiny location delta). That explodes CPU and re-renders → map freezes and you think “I have to refresh”.

Below I’ll explain the problems, give quick debug checks, and then give **paste-ready code** improvements (safe, incremental) you can drop into your repo.

---

# Short diagnosis — why you still need to refresh

- Your real-time subscription updates `drivers` frequently (good). But you call `setDrivers(...)` on every animation tick (RAF) for every driver. That becomes hundreds of state updates/second when many drivers change → React + Google Map get overwhelmed. The UI can appear frozen; sometimes the realtime socket reconnects and you need a manual refresh.
- `DirectionsService.route()` is being called whenever `routeParams` effect runs. If `trips` change often (or `selectedDriverId` triggers repeatedly) you may be making many Directions requests. Google rate-limits, causing request failures and stalls on the map side.
- Also: small/no-op updates (target nearly identical to current) still cause state updates. We need to ignore those.

Fix strategy:

1. **Throttle + batch state updates** (don’t call `setDrivers` every RAF; only once per 200–500ms).
2. **Only update drivers that moved** by a meaningful distance (threshold), otherwise ignore.
3. **Cache & debounce Directions requests** per `tripId` (only fetch once unless origin/destination changed).
4. Add instrumentation/logging to detect if realtime messages stop.

---

# Quick checks (do these first)

1. Open browser Console / Network → WebSocket to confirm Supabase realtime channel is connected and receiving messages.
2. Watch for `OVER_QUERY_LIMIT` or `403` from Google Directions in Network tab.
3. Temporarily disable DirectionsRenderer (comment it out) and see if freezing stops — if yes, Directions requests are a culprit.
4. Add `console.log` inside Supabase subscription callback to confirm events stream in.

---

# Paste-ready improvements

Below are the replacements / patches you should apply. They are conservative and incremental — apply **useLiveTracking** and the **Directions caching** logic first.

---

## 1) `useLiveTracking` — throttle and only update changed drivers

Replace your `useLiveTracking` file with this. Key points:

- Uses a `positionsRef` for mutable display positions so we avoid heavy state updates every frame.
- Uses `setInterval` at `UPDATE_FPS = 4` (250ms) to batch and set drivers only when there are meaningful changes.
- Subscription handler ignores tiny/no-op updates (distance threshold).
- Uses simple distance (approx degrees) threshold — tweak `DELTA_THRESH`.

```ts
// useLiveTracking.ts
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import { interpolateLatLng, calculateBearing } from "@/lib/geo";
import type { LiveDriver, LiveTrip } from "./types";

const UPDATE_FPS = 4; // 4 updates per second (250ms)
const UPDATE_INTERVAL_MS = 1000 / UPDATE_FPS;
const DELTA_THRESH = 0.00001; // ignore tiny coordinate deltas

function approxSqDist(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const dy = a.lat - b.lat;
  const dx = a.lng - b.lng;
  return dx * dx + dy * dy;
}

export function useLiveTracking() {
  const { currentOrganization } = useOrganization();
  const [drivers, setDrivers] = useState<LiveDriver[]>([]);
  const [trips, setTrips] = useState<LiveTrip[]>([]);
  const [loading, setLoading] = useState(true);

  // positionsRef holds the animated/display positions (mutable)
  const positionsRef = useRef<
    Map<
      string,
      {
        lat: number;
        lng: number;
        target?: { lat: number; lng: number };
        bearing?: number;
      }
    >
  >(new Map());

  // Helper to snapshot positionsRef into state (only changed ones)
  const flushPositionsToState = () => {
    const arr: LiveDriver[] = [];
    positionsRef.current.forEach((val, id) => {
      const existing = drivers.find((d) => d.id === id);
      arr.push({
        id,
        full_name: existing?.full_name || "Driver",
        // keep other fields from existing state if present
        current_lat: val.lat,
        current_lng: val.lng,
        last_location_update: existing?.last_location_update,
        active: existing?.active ?? true,
        status: existing?.status ?? "idle",
        active_trip_id: existing?.active_trip_id,
        // animation-specific
        lat: val.lat,
        lng: val.lng,
        target: val.target,
        bearing: val.bearing ?? 0,
      });
    });

    // Only set state if there is a change in size or significant differences
    setDrivers(arr);
  };

  // Animate/batch loop (runs at UPDATE_FPS)
  useEffect(() => {
    const timer = setInterval(() => {
      let changed = false;
      positionsRef.current.forEach((val, id) => {
        if (!val.target) return;
        const distSq = approxSqDist({ lat: val.lat, lng: val.lng }, val.target);
        if (distSq < DELTA_THRESH) {
          // close enough, snap to target and clear target
          if (val.lat !== val.target.lat || val.lng !== val.target.lng) {
            val.lat = val.target.lat;
            val.lng = val.target.lng;
            val.bearing = calculateBearing(
              { lat: val.lat, lng: val.lng },
              val.target,
            );
            val.target = undefined;
            changed = true;
          }
          return;
        }

        // interpolate toward target
        const next = interpolateLatLng(
          { lat: val.lat, lng: val.lng },
          val.target,
          0.18,
        );
        val.bearing = calculateBearing(
          { lat: val.lat, lng: val.lng },
          val.target,
        );
        val.lat = next.lat;
        val.lng = next.lng;
        changed = true;
      });

      if (changed) flushPositionsToState();
    }, UPDATE_INTERVAL_MS);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id]); // re-create on org change

  // Initial fetch
  useEffect(() => {
    if (!currentOrganization?.id) return;
    (async () => {
      try {
        const { data: driversData } = await supabase
          .from("drivers")
          .select(
            "id, full_name, current_lat, current_lng, last_location_update, active",
          )
          .eq("org_id", currentOrganization.id);

        const { data: tripsData } = await supabase
          .from("trips")
          .select(
            `
            id, 
            status, 
            driver_id, 
            pickup_location, 
            dropoff_location, 
            pickup_time,
            patient:patients(full_name),
            driver:drivers(full_name)
          `,
          )
          .eq("org_id", currentOrganization.id)
          .in("status", ["en_route", "in_progress"]);

        const formattedTrips: LiveTrip[] = (tripsData || []).map((t: any) => ({
          id: t.id,
          status: t.status,
          driver_id: t.driver_id,
          pickup_location: t.pickup_location,
          dropoff_location: t.dropoff_location,
          pickup_time: t.pickup_time,
          patient: t.patient,
          driver: t.driver,
        }));

        // seed positionsRef
        const map = new Map<string, any>();
        (driversData || []).forEach((d: any) => {
          const lat = d.current_lat ?? 0;
          const lng = d.current_lng ?? 0;
          map.set(d.id, {
            lat,
            lng,
            target: { lat, lng },
            bearing: 0,
          });
        });
        positionsRef.current = map;

        // set initial drivers state
        const initialDrivers: LiveDriver[] = (driversData || []).map(
          (d: any) => {
            const activeTrip = formattedTrips.find((t) => t.driver_id === d.id);
            let status: LiveDriver["status"] = "idle";
            if (!d.active) status = "offline";
            else if (activeTrip) status = "en_route";
            const lat = d.current_lat ?? 0;
            const lng = d.current_lng ?? 0;

            return {
              ...d,
              lat,
              lng,
              target: { lat, lng },
              bearing: 0,
              status,
              active_trip_id: activeTrip?.id,
              current_lat: lat,
              current_lng: lng,
            };
          },
        );

        setDrivers(initialDrivers);
        setTrips(formattedTrips);
      } catch (err) {
        console.error("Error fetching live tracking data:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentOrganization?.id]);

  // Realtime: only set target / update small fields (avoid full state write here)
  useEffect(() => {
    if (!currentOrganization?.id) return;

    const channel = supabase
      .channel("drivers-live")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "drivers",
          filter: `org_id=eq.${currentOrganization.id}`,
        },
        (payload) => {
          const id = payload.new.id;
          const newLat = payload.new.current_lat;
          const newLng = payload.new.current_lng;

          // defensive: ignore if coords missing
          if (typeof newLat !== "number" || typeof newLng !== "number") return;

          const existing = positionsRef.current.get(id);
          if (!existing) {
            // seed new driver entry
            positionsRef.current.set(id, {
              lat: newLat,
              lng: newLng,
              target: { lat: newLat, lng: newLng },
              bearing: 0,
            });
            // set a quick flush to include new driver in UI
            flushPositionsToState();
            return;
          }

          // if the requested target is nearly equal to current target, ignore to avoid churn
          const prevTarget = existing.target ?? {
            lat: existing.lat,
            lng: existing.lng,
          };
          const deltaSq = approxSqDist(prevTarget, {
            lat: newLat,
            lng: newLng,
          });
          if (deltaSq < DELTA_THRESH * 1.0) {
            // small/no-op
            return;
          }

          // set a new target (animated)
          existing.target = { lat: newLat, lng: newLng };

          // update small DB fields for sidebar quickly (not full setDrivers)
          setDrivers((prev) =>
            prev.map((d) =>
              d.id === id
                ? {
                    ...d,
                    current_lat: newLat,
                    current_lng: newLng,
                    last_location_update: payload.new.last_location_update,
                    active: payload.new.active,
                    // keep animated lat/lng unchanged (positionsRef will animate)
                  }
                : d,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trips",
          filter: `org_id=eq.${currentOrganization.id}`,
        },
        () => {
          // minimally refetch trips
          supabase
            .from("trips")
            .select(
              `
              id, status, driver_id, pickup_location, dropoff_location, pickup_time,
              patient:patients(full_name), driver:drivers(full_name)
            `,
            )
            .eq("org_id", currentOrganization.id)
            .in("status", ["en_route", "in_progress"])
            .then(({ data }) => {
              if (data) {
                const formatted = data.map((t: any) => ({
                  id: t.id,
                  status: t.status,
                  driver_id: t.driver_id,
                  pickup_location: t.pickup_location,
                  dropoff_location: t.dropoff_location,
                  pickup_time: t.pickup_time,
                  patient: t.patient,
                  driver: t.driver,
                }));
                setTrips(formatted);
              }
            });
        },
      )
      .subscribe();

    // log channel state for debugging
    console.info("Subscribed to drivers-live channel", channel);

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrganization?.id]);

  return { drivers, trips, loading };
}
```

**Why this helps**

- We avoid heavy `setDrivers` on every RAF; instead we mutate `positionsRef` (cheap) and flush batched updates at 250ms.
- Subscription only updates targets and small fields — minimal re-renders.
- We ignore tiny/no-op updates.

---

## 2) Directions caching + debounce in `LiveMap` (avoid spamming Google)

Replace the directions effect in your `LiveMap` with this improved version. It:

- Caches directions results keyed by `tripId|origin|destination`.
- Debounces repeated requests for the same trip.
- Ignored if origin/destination unchanged.

```ts
// inside LiveMap component
const directionsCacheRef = useRef<Map<string, google.maps.DirectionsResult>>(
  new Map(),
);
const pendingDirectionsRef = useRef<Set<string>>(new Set());

useEffect(() => {
  if (!routeParams || !map) {
    setDirectionsResponse(null);
    return;
  }

  const key = `${routeParams.tripId}::${routeParams.origin}::${routeParams.destination}`;
  // if cached, use it
  const cached = directionsCacheRef.current.get(key);
  if (cached) {
    setDirectionsResponse(cached);
    return;
  }

  // if already pending, don't re-request
  if (pendingDirectionsRef.current.has(key)) return;

  pendingDirectionsRef.current.add(key);

  const directionsService = new google.maps.DirectionsService();
  directionsService.route(
    {
      origin: routeParams.origin,
      destination: routeParams.destination,
      travelMode: google.maps.TravelMode.DRIVING,
    },
    (result, status) => {
      pendingDirectionsRef.current.delete(key);

      if (status === google.maps.DirectionsStatus.OK && result) {
        directionsCacheRef.current.set(key, result);
        setDirectionsResponse(result);
      } else {
        console.warn("Directions request failed:", status);
        // don't clear existing route if there is one; but we clear state for safety
        setDirectionsResponse(null);
      }
    },
  );

  // optional: clear the cache for this key after X minutes if you need fresh routes
  // const t = setTimeout(() => directionsCacheRef.current.delete(key), 1000 * 60 * 10);
  // return () => clearTimeout(t);
}, [routeParams, map]);
```

**Why this helps**

- Prevents duplicate Directions calls for the same trip.
- If `trips` update rapidly, this avoids a storm of requests.
- If the driver is only moving, the route usually doesn't need recompute until origin/destination change.

---

## 3) LiveMap: render markers from `drivers` state lat/lng fields

You already switched to `lat`/`lng`. Two small notes:

- Make `points` creation robust: only include drivers with finite `lat/lng`.

```ts
const points = useMemo(() => {
  return drivers
    .filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng))
    .map(d => ({ ... }));
}, [drivers]);
```

- Use `OverlayView` keys that are stable and unique (you already use driver.id — good).

---

## 4) Extra defensive checks & debugging helpers

Add a tiny debug helper during development to see channel health:

```ts
// after channel = supabase.channel(...)
channel.subscribe(async (status) => {
  console.info("supabase channel status:", status);
});
```

Also add console logs inside your subscription callback to count messages:

```ts
let msgCount = 0;
.on(..., (payload) => {
  msgCount++;
  if (msgCount % 50 === 0) console.info("drivers-live messages so far:", msgCount);
  ...
});
```

---

# Tuning knobs & tradeoffs

- `UPDATE_FPS` 4 (250ms) is a good compromise. Lower (2fps) reduces CPU; higher makes motion smoother but more CPU.
- `DELTA_THRESH` controls sensitivity. Increase it to ignore GPS jitter.
- Directions cache TTL: you can expire cached routes every 5–10 minutes (depends on app need).

---

# If you still need manual refresh after this

1. Confirm Supabase channel is still connected — if not, we need reconnect logic (supabase usually reconnects but check your client init).
2. Log the subscription payloads. If payloads arrive and `positionsRef` updates but UI doesn't reflect them, ensure `flushPositionsToState()` is being called (look for debounced tick). If that is running and still no UI update, there’s likely a rendering block — check long-running JS tasks (profiling).
3. Temporarily disable `DirectionsRenderer` and clustering (supercluster) and test. If freeze stops, re-enable them gradually to find the culprit.

---

# Summary / Action plan (concrete)

1. Replace `useLiveTracking` with the batched version above.
2. Add the Directions caching effect in `LiveMap`.
3. Use the defensive points filtering and small logging.
4. Test with ~10 drivers simulating movement — watch Network and Console for errors.
5. Tune FPS and DELTA until CPU acceptable.

If you want, I can:

- Provide a small test harness (generate simulated GPS updates to Supabase) so you can stress-test without driving.
- Inspect your app-side location frequency and suggest server-side rate-limits or CDN for supabase functions if the ETA function is being invoked too often.

Want the simulated GPS test harness next? I can paste it ready-to-run (edge function + small script) so you can safely load-test the live page.
