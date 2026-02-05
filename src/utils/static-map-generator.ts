/**
 * Static Map Generator for PDF Trip Summaries
 *
 * Generates a minimal Google Static Map URL that visualizes:
 * - Route path (blue polyline)
 * - Deviation paths (orange polylines)
 * - Pickup (A) and Dropoff (B) markers
 *
 * Uses encoded polylines for compact URL generation to stay within URL length limits.
 */

export interface RoutePathData {
  /** Actual driven path (gray in live map, we'll skip for static since it overlaps) */
  drivenPath?: { lat: number; lng: number }[];
  /** Remaining/planned route (blue) */
  plannedPath?: { lat: number; lng: number }[];
  /** Deviation segments (orange) */
  deviationPaths?: { lat: number; lng: number }[][];
}

export interface TripMapData {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  routePaths?: RoutePathData;
}

/**
 * Encodes a polyline using Google's Polyline Algorithm
 * @see https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
function encodePolyline(path: { lat: number; lng: number }[]): string {
  if (!path || path.length === 0) return "";

  let encoded = "";
  let prevLat = 0;
  let prevLng = 0;

  for (const point of path) {
    const lat = Math.round(point.lat * 1e5);
    const lng = Math.round(point.lng * 1e5);

    encoded += encodeSignedNumber(lat - prevLat);
    encoded += encodeSignedNumber(lng - prevLng);

    prevLat = lat;
    prevLng = lng;
  }

  return encoded;
}

function encodeSignedNumber(num: number): string {
  let sgn_num = num << 1;
  if (num < 0) {
    sgn_num = ~sgn_num;
  }
  return encodeNumber(sgn_num);
}

function encodeNumber(num: number): string {
  let encoded = "";
  while (num >= 0x20) {
    encoded += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
    num >>= 5;
  }
  encoded += String.fromCharCode(num + 63);
  return encoded;
}

/**
 * Simplifies a path by reducing the number of points using Douglas-Peucker algorithm
 * This helps keep the URL length manageable for complex routes
 */
function simplifyPath(
  path: { lat: number; lng: number }[],
  tolerance = 0.0001,
): { lat: number; lng: number }[] {
  if (path.length <= 2) return path;

  // Find the point with the maximum distance from the line
  let maxDist = 0;
  let maxIndex = 0;
  const start = path[0];
  const end = path[path.length - 1];

  for (let i = 1; i < path.length - 1; i++) {
    const dist = perpendicularDistance(path[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDist > tolerance) {
    const left = simplifyPath(path.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPath(path.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [start, end];
}

function perpendicularDistance(
  point: { lat: number; lng: number },
  lineStart: { lat: number; lng: number },
  lineEnd: { lat: number; lng: number },
): number {
  const dx = lineEnd.lng - lineStart.lng;
  const dy = lineEnd.lat - lineStart.lat;

  if (dx === 0 && dy === 0) {
    return Math.sqrt(
      Math.pow(point.lng - lineStart.lng, 2) +
        Math.pow(point.lat - lineStart.lat, 2),
    );
  }

  const t =
    ((point.lng - lineStart.lng) * dx + (point.lat - lineStart.lat) * dy) /
    (dx * dx + dy * dy);

  const nearestLng = lineStart.lng + t * dx;
  const nearestLat = lineStart.lat + t * dy;

  return Math.sqrt(
    Math.pow(point.lng - nearestLng, 2) + Math.pow(point.lat - nearestLat, 2),
  );
}

/**
 * Generates a Google Static Maps URL for trip visualization
 *
 * @param data Trip map data including pickup/dropoff and optional route paths
 * @param width Map width in pixels (max 640 for free tier)
 * @param height Map height in pixels (max 640 for free tier)
 * @returns Static map URL string
 */
export function generateStaticMapUrl(
  data: TripMapData,
  width = 400,
  height = 200,
): string {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn("[StaticMap] No Google Maps API key available");
    return "";
  }

  // Clamp dimensions to free tier limits
  width = Math.min(width, 640);
  height = Math.min(height, 640);

  const baseUrl = "https://maps.googleapis.com/maps/api/staticmap";
  const params: string[] = [
    `size=${width}x${height}`,
    "maptype=roadmap",
    "format=png",
    `key=${apiKey}`,
  ];

  // Add markers for pickup (A) and dropoff (B)
  params.push(
    `markers=color:green|label:A|${data.pickupLat},${data.pickupLng}`,
  );
  params.push(
    `markers=color:red|label:B|${data.dropoffLat},${data.dropoffLng}`,
  );

  // Add route paths if available
  if (data.routePaths) {
    // Planned/remaining route (blue) - most important
    if (data.routePaths.plannedPath && data.routePaths.plannedPath.length > 1) {
      const simplified = simplifyPath(data.routePaths.plannedPath, 0.0002);
      const encoded = encodePolyline(simplified);
      if (encoded) {
        params.push(`path=color:0x3b82f6ff|weight:4|enc:${encoded}`);
      }
    }

    // Deviation paths (orange)
    if (data.routePaths.deviationPaths) {
      for (const devPath of data.routePaths.deviationPaths) {
        if (devPath.length > 1) {
          const simplified = simplifyPath(devPath, 0.0002);
          const encoded = encodePolyline(simplified);
          if (encoded) {
            params.push(`path=color:0xf97316ff|weight:3|enc:${encoded}`);
          }
        }
      }
    }

    // Driven path (gray) - optional, only if no planned path
    if (
      !data.routePaths.plannedPath &&
      data.routePaths.drivenPath &&
      data.routePaths.drivenPath.length > 1
    ) {
      const simplified = simplifyPath(data.routePaths.drivenPath, 0.0002);
      const encoded = encodePolyline(simplified);
      if (encoded) {
        params.push(`path=color:0x9ca3afff|weight:3|enc:${encoded}`);
      }
    }
  }

  const url = `${baseUrl}?${params.join("&")}`;

  // Check URL length - Google has a 8192 character limit
  if (url.length > 8000) {
    console.warn(
      `[StaticMap] URL length (${url.length}) approaching limit, may need more simplification`,
    );
  }

  return url;
}

/**
 * Fetches a static map image as a base64 data URL for embedding in PDFs
 *
 * @param data Trip map data
 * @param width Map width
 * @param height Map height
 * @returns Promise resolving to base64 data URL or null on failure
 */
export async function getStaticMapImage(
  data: TripMapData,
  width = 400,
  height = 200,
): Promise<string | null> {
  const url = generateStaticMapUrl(data, width, height);
  if (!url) return null;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("[StaticMap] Failed to fetch map image:", response.status);
      return null;
    }

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("[StaticMap] Error fetching map image:", error);
    return null;
  }
}

/**
 * Creates a simple map URL with just pickup and dropoff markers
 * Used when no route data is available
 */
export function generateSimpleMapUrl(
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
  width = 400,
  height = 200,
): string {
  return generateStaticMapUrl(
    {
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng,
    },
    width,
    height,
  );
}
