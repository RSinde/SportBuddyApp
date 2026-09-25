export type Coordinates = {
  lat: number;
  lng: number;
};

const EARTH_RADIUS_KM = 6371;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function calculateDistanceKm(
  from: Coordinates,
  to: Coordinates
): number {
  const latDistance = toRadians(to.lat - from.lat);
  const lngDistance = toRadians(to.lng - from.lng);

  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);

  const a =
    Math.sin(latDistance / 2) * Math.sin(latDistance / 2) +
    Math.cos(fromLat) *
      Math.cos(toLat) *
      Math.sin(lngDistance / 2) *
      Math.sin(lngDistance / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

export function isWithinRadiusKm(
  center: Coordinates,
  point: Coordinates,
  radiusKm: number
): boolean {
  return calculateDistanceKm(center, point) <= radiusKm;
}

export function isValidCoordinates(location: Coordinates): boolean {
  return (
    typeof location.lat === "number" &&
    typeof location.lng === "number" &&
    location.lat >= -90 &&
    location.lat <= 90 &&
    location.lng >= -180 &&
    location.lng <= 180 &&
    !(location.lat === 0 && location.lng === 0)
  );
}