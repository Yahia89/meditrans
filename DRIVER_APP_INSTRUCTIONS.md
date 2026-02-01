# React Native Driver App Instructions

To achieve "Uber-like" smooth real-time tracking, you need to broadcast location updates directly to the web client via Supabase Realtime Broadcast, bypassing the database write latency for the animation stream.

## 1. Update `BackgroundGeolocation` configuration

In your React Native `driverLocationService.ts` (or wherever you configure `react-native-background-geolocation`), add the logic to emit a Supabase Broadcast event whenever a location is recorded.

```typescript
import BackgroundGeolocation, {
  Location,
} from "react-native-background-geolocation";
import { supabase } from "./lib/supabase"; // Your supabase client

// 1. Create a single channel for broadcasting driver locations
const locationChannel = supabase.channel("drivers-live");

// 2. Subscribe to the channel (needed to be able to send)
locationChannel.subscribe((status) => {
  if (status === "SUBSCRIBED") {
    console.log("✅ Connected to drivers-live broadcast channel");
  }
});

BackgroundGeolocation.onLocation(
  async (location: Location) => {
    console.log("[Location] ", location);

    // 3. BROADCAST the location immediately (Low Latency)
    // This goes directly to connected web clients via Websocket (< 100ms)
    await locationChannel.send({
      type: "broadcast",
      event: "location-update",
      payload: {
        id: DRIVER_ID, // Use the actual logged-in driver's ID
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        heading: location.coords.heading, // Important: Send the GPS bearing if available
        speed: location.coords.speed,
        timestamp: new Date().toISOString(),
      },
    });

    // 4. PERSIST to Database (History & Reliability)
    // This continues to work as before, saving the trail for reporting/analytics.
    // The web client will ignore these "postgres_changes" for animation if it receives the broadcast.
    const { error } = await supabase
      .from("drivers")
      .update({
        current_lat: location.coords.latitude,
        current_lng: location.coords.longitude,
        // ... any other fields you usually update
        last_location_update: new Date().toISOString(),
      })
      .eq("id", DRIVER_ID);

    if (error) console.error("DB Update Error:", error);
  },
  (error) => {
    console.error("[Location] ERROR:", error);
  },
);
```

## Summary of Changes

1.  **Initialize Channel**: Create `supabase.channel('drivers-live')`.
2.  **Broadcast**: Inside `onLocation`, call `channel.send({...})`.
3.  **Payload**: Ensure you send `lat`, `lng`, `heading`, and `id`.

This change allows the web dashboard to receive updates typically within 20-50ms, compared to the 1-3s latency of the Database -> Realtime workflow.
