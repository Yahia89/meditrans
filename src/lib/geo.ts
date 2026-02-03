/**
 * Geometry utilities for live tracking
 * Route-aware interpolation and deviation detection (Uber-tier architecture)
 */

// ============================================================================
// BASIC MATH UTILITIES
// ============================================================================

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ============================================================================
// LAT/LNG UTILITIES
// ============================================================================

export function interpolateLatLng(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  t: number,
): { lat: number; lng: number } {
  return {
    lat: lerp(from.lat, to.lat, t),
    lng: lerp(from.lng, to.lng, t),
  };
}

/**
 * Calculate bearing between two points (in degrees, 0 = North, clockwise)
 */
export function calculateBearing(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const φ1 = toRad(from.lat);
  const φ2 = toRad(to.lat);
  const λ1 = toRad(from.lng);
  const λ2 = toRad(to.lng);

  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Haversine distance between two points (in meters)
 */
export function haversineDistance(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number },
): number {
  const R = 6371000; // Earth's radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180;

  const dLat = toRad(p2.lat - p1.lat);
  const dLon = toRad(p2.lng - p1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(p1.lat)) *
      Math.cos(toRad(p2.lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Fast approximate squared distance (for comparison only, not real distance)
 */
export function approxSqDist(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = a.lat - b.lat;
  const dLng = a.lng - b.lng;
  return dLat * dLat + dLng * dLng;
}

// ============================================================================
// POLYLINE UTILITIES (Route-aware animation)
// ============================================================================

export interface PolylinePoint {
  lat: number;
  lng: number;
}

/**
 * Decode a Google Maps encoded polyline string into an array of LatLng points
 * This is a pure JS implementation that doesn't require google.maps.geometry
 */
export function decodePolyline(encoded: string): PolylinePoint[] {
  const points: PolylinePoint[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;

    // Decode latitude
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    // Decode longitude
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return points;
}

/**
 * Calculate cumulative distances along a polyline (for efficient position lookups)
 */
export function calculateCumulativeDistances(
  polyline: PolylinePoint[],
): number[] {
  const distances: number[] = [0];
  let total = 0;

  for (let i = 1; i < polyline.length; i++) {
    total += haversineDistance(polyline[i - 1], polyline[i]);
    distances.push(total);
  }

  return distances;
}

/**
 * Find the closest point on a polyline segment to a given point
 * Returns the projected point and the squared distance
 */
export function projectPointOnSegment(
  point: PolylinePoint,
  segStart: PolylinePoint,
  segEnd: PolylinePoint,
): { projected: PolylinePoint; distanceSq: number; t: number } {
  const dx = segEnd.lng - segStart.lng;
  const dy = segEnd.lat - segStart.lat;
  const lenSq = dx * dx + dy * dy;

  // Segment is a point
  if (lenSq < 1e-12) {
    return {
      projected: segStart,
      distanceSq: approxSqDist(point, segStart),
      t: 0,
    };
  }

  // Project point onto the line (clamped to segment)
  const t = clamp(
    ((point.lng - segStart.lng) * dx + (point.lat - segStart.lat) * dy) / lenSq,
    0,
    1,
  );

  const projected = {
    lat: segStart.lat + t * dy,
    lng: segStart.lng + t * dx,
  };

  return {
    projected,
    distanceSq: approxSqDist(point, projected),
    t,
  };
}

/**
 * Find the nearest point on a polyline to a given location
 * Returns segment index, projected point, and distance in meters
 */
export function findNearestPointOnPolyline(
  point: PolylinePoint,
  polyline: PolylinePoint[],
): {
  segmentIndex: number;
  projected: PolylinePoint;
  distanceMeters: number;
  t: number; // Position within segment (0-1)
} {
  if (polyline.length === 0) {
    return {
      segmentIndex: 0,
      projected: point,
      distanceMeters: Infinity,
      t: 0,
    };
  }

  if (polyline.length === 1) {
    return {
      segmentIndex: 0,
      projected: polyline[0],
      distanceMeters: haversineDistance(point, polyline[0]),
      t: 0,
    };
  }

  let minDistSq = Infinity;
  let bestSegment = 0;
  let bestProjected = polyline[0];
  let bestT = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const { projected, distanceSq, t } = projectPointOnSegment(
      point,
      polyline[i],
      polyline[i + 1],
    );

    if (distanceSq < minDistSq) {
      minDistSq = distanceSq;
      bestSegment = i;
      bestProjected = projected;
      bestT = t;
    }
  }

  return {
    segmentIndex: bestSegment,
    projected: bestProjected,
    distanceMeters: haversineDistance(point, bestProjected),
    t: bestT,
  };
}

/**
 * Get position on polyline at a specific distance from start
 */
export function getPositionAtDistance(
  polyline: PolylinePoint[],
  cumulativeDistances: number[],
  distanceMeters: number,
): { position: PolylinePoint; segmentIndex: number; bearing: number } {
  if (polyline.length === 0) {
    return { position: { lat: 0, lng: 0 }, segmentIndex: 0, bearing: 0 };
  }

  if (polyline.length === 1 || distanceMeters <= 0) {
    const bearing =
      polyline.length > 1 ? calculateBearing(polyline[0], polyline[1]) : 0;
    return { position: polyline[0], segmentIndex: 0, bearing };
  }

  const totalDistance = cumulativeDistances[cumulativeDistances.length - 1];

  // Clamp to route bounds
  if (distanceMeters >= totalDistance) {
    const lastIdx = polyline.length - 1;
    const bearing = calculateBearing(polyline[lastIdx - 1], polyline[lastIdx]);
    return { position: polyline[lastIdx], segmentIndex: lastIdx - 1, bearing };
  }

  // Binary search for the segment
  let left = 0;
  let right = cumulativeDistances.length - 1;

  while (left < right) {
    const mid = Math.floor((left + right + 1) / 2);
    if (cumulativeDistances[mid] <= distanceMeters) {
      left = mid;
    } else {
      right = mid - 1;
    }
  }

  const segmentIndex = left;
  const segmentStart = polyline[segmentIndex];
  const segmentEnd = polyline[segmentIndex + 1];
  const segmentStartDist = cumulativeDistances[segmentIndex];
  const segmentEndDist = cumulativeDistances[segmentIndex + 1];
  const segmentLength = segmentEndDist - segmentStartDist;

  // How far along this segment?
  const t =
    segmentLength > 0 ? (distanceMeters - segmentStartDist) / segmentLength : 0;

  const position = interpolateLatLng(segmentStart, segmentEnd, t);
  const bearing = calculateBearing(segmentStart, segmentEnd);

  return { position, segmentIndex, bearing };
}

/**
 * Get the distance along the polyline from start to a specific segment + t position
 */
export function getDistanceAtSegment(
  cumulativeDistances: number[],
  polyline: PolylinePoint[],
  segmentIndex: number,
  t: number,
): number {
  if (segmentIndex >= cumulativeDistances.length - 1) {
    return cumulativeDistances[cumulativeDistances.length - 1];
  }

  const segmentStartDist = cumulativeDistances[segmentIndex];
  const segmentEndDist = cumulativeDistances[segmentIndex + 1];
  const segmentLength = segmentEndDist - segmentStartDist;

  return segmentStartDist + t * segmentLength;
}

// ============================================================================
// ROUTE DEVIATION DETECTION
// ============================================================================

/**
 * Check if a point is within tolerance of a polyline
 * This is a free client-side check (no API cost!)
 * @param point The driver's current GPS position
 * @param polyline The route polyline
 * @param toleranceMeters How far off-route is acceptable (default 50m)
 */
export function isOnRoute(
  point: PolylinePoint,
  polyline: PolylinePoint[],
  toleranceMeters: number = 50,
): boolean {
  if (polyline.length < 2) return true;

  const { distanceMeters } = findNearestPointOnPolyline(point, polyline);
  return distanceMeters <= toleranceMeters;
}

// ============================================================================
// SMOOTH BEARING INTERPOLATION
// ============================================================================

/**
 * Smoothly interpolate between two bearings (handles 360°→0° wrap)
 */
export function lerpBearing(from: number, to: number, t: number): number {
  // Normalize bearings to 0-360
  from = ((from % 360) + 360) % 360;
  to = ((to % 360) + 360) % 360;

  // Find the shortest angular distance
  let diff = to - from;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  // Interpolate and normalize
  return (((from + diff * t) % 360) + 360) % 360;
}

// ============================================================================
// VELOCITY-BASED PREDICTION (for brief GPS gaps)
// ============================================================================

export interface VelocityState {
  lat: number;
  lng: number;
  velocityLat: number; // degrees per second
  velocityLng: number;
  bearing: number;
  timestamp: number;
}

/**
 * Predict position based on last known velocity
 * Useful for dead-reckoning during brief GPS gaps
 */
export function predictPosition(
  state: VelocityState,
  currentTime: number,
  maxPredictionMs: number = 5000,
): PolylinePoint {
  const elapsed = Math.min(currentTime - state.timestamp, maxPredictionMs);
  const elapsedSec = elapsed / 1000;

  return {
    lat: state.lat + state.velocityLat * elapsedSec,
    lng: state.lng + state.velocityLng * elapsedSec,
  };
}

/**
 * Update velocity estimate from position change
 */
export function updateVelocity(
  prevState: VelocityState | null,
  newLat: number,
  newLng: number,
  newTimestamp: number,
  smoothingFactor: number = 0.3,
): VelocityState {
  if (!prevState || newTimestamp <= prevState.timestamp) {
    return {
      lat: newLat,
      lng: newLng,
      velocityLat: 0,
      velocityLng: 0,
      bearing: 0,
      timestamp: newTimestamp,
    };
  }

  const dt = (newTimestamp - prevState.timestamp) / 1000;
  if (dt < 0.1) {
    // Too small time delta, don't update velocity
    return {
      ...prevState,
      lat: newLat,
      lng: newLng,
      timestamp: newTimestamp,
    };
  }

  const newVelocityLat = (newLat - prevState.lat) / dt;
  const newVelocityLng = (newLng - prevState.lng) / dt;

  // Smooth the velocity using exponential moving average
  const smoothedVelocityLat = lerp(
    prevState.velocityLat,
    newVelocityLat,
    smoothingFactor,
  );
  const smoothedVelocityLng = lerp(
    prevState.velocityLng,
    newVelocityLng,
    smoothingFactor,
  );

  // Calculate bearing from velocity
  const bearing =
    (Math.atan2(smoothedVelocityLng, smoothedVelocityLat) * 180) / Math.PI;

  return {
    lat: newLat,
    lng: newLng,
    velocityLat: smoothedVelocityLat,
    velocityLng: smoothedVelocityLng,
    bearing: (bearing + 360) % 360,
    timestamp: newTimestamp,
  };
}
