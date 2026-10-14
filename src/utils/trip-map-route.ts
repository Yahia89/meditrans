import { loadGoogleMaps } from "./google-maps-loader.ts";
import { resolveMapLocation, type TripMapData } from "./static-map-generator.ts";

/** Calculate one road route for the PDF; this is not recorded driving history. */
export async function fetchPrimaryDrivingRoute(
  data: TripMapData,
  loadMaps = loadGoogleMaps,
  timeoutMs = 10_000,
): Promise<string | null> {
  const origin = resolveMapLocation(data.pickupLat, data.pickupLng, data.pickupAddress);
  const destination = resolveMapLocation(data.dropoffLat, data.dropoffLng, data.dropoffAddress);
  if (!origin || !destination) return null;

  let timeout: ReturnType<typeof setTimeout> | undefined;
  let expired = false;
  try {
    return await Promise.race([
      (async () => {
        const maps = await loadMaps();
        if (expired) return null;
        const result = await new maps.DirectionsService().route({
          origin,
          destination,
          travelMode: maps.TravelMode.DRIVING,
          provideRouteAlternatives: false,
        });
        const polyline = result.routes[0]?.overview_polyline;
        return typeof polyline === "string" && polyline.trim() ? polyline : null;
      })(),
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => {
          expired = true;
          resolve(null);
        }, timeoutMs);
      }),
    ]);
  } catch {
    // Keep the A/B map usable when directions are unavailable. Never replace
    // a missing road route with a misleading straight line between endpoints.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
