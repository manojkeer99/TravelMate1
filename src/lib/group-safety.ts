export const DEFAULT_GROUP_RANGE_METERS = 500;
export const MIN_GROUP_RANGE_METERS = 50;
export const MAX_GROUP_RANGE_METERS = 10_000;
export const LOCATION_STALE_AFTER_MS = 10 * 60 * 1000;

export const SAFETY_RADIUS_PRESETS = [
  { value: 100, label: "100 m", description: "100 metres" },
  { value: 250, label: "250 m", description: "250 metres" },
  { value: 500, label: "500 m", description: "500 metres" },
  { value: 1000, label: "1,000 m (1 km)", description: "1,000 metres (1 km)" },
  { value: 2000, label: "2,000 m (2 km)", description: "2,000 metres (2 km)" },
] as const;

export function formatRadiusDistance(meters: number): string {
  const rounded = Math.round(meters);
  if (rounded >= 1000) {
    const km = rounded / 1000;
    return `${rounded.toLocaleString("en-IN")} metres (${Number.isInteger(km) ? km : km.toFixed(2)} km)`;
  }
  return `${rounded.toLocaleString("en-IN")} metres`;
}

export function cleanGroupText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

export function safeRangeMeters(value: unknown) {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? Math.max(MIN_GROUP_RANGE_METERS, Math.min(parsed, MAX_GROUP_RANGE_METERS)) : DEFAULT_GROUP_RANGE_METERS;
}

export function createInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function isValidCoordinate(value: unknown, min: number, max: number) {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= min && coordinate <= max ? coordinate : null;
}

export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const earthRadius = 6_371_000;
  const deltaLatitude = toRadians(b.latitude - a.latitude);
  const deltaLongitude = toRadians(b.longitude - a.longitude);
  const latitudeA = toRadians(a.latitude);
  const latitudeB = toRadians(b.latitude);
  const h = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(deltaLongitude / 2) ** 2;
  return Math.round(2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}
