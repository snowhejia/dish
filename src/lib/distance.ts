import { distance, versionDistance, type DishVersion } from '@/data/mockData';

export type Coordinates = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_METRES = 6_371_000;

export function haversineDistanceMetres(from: Coordinates, to: Coordinates) {
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const halfLatitude = Math.sin(latitudeDelta / 2);
  const halfLongitude = Math.sin(longitudeDelta / 2);
  const a = halfLatitude * halfLatitude
    + Math.cos(fromLatitude) * Math.cos(toLatitude) * halfLongitude * halfLongitude;
  const clampedA = Math.min(1, Math.max(0, a));

  return EARTH_RADIUS_METRES * 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
}

export function versionDistanceFromCoordinates(
  version: DishVersion,
  coordinates: Coordinates | null,
) {
  const metres = versionMetresFromCoordinates(version, coordinates);
  return metres == null ? versionDistance(version) : distance(Math.round(metres));
}

export function versionMetresFromCoordinates(
  version: DishVersion,
  coordinates: Coordinates | null,
) {
  if (
    !coordinates
    || version.latitude == null
    || version.longitude == null
    || !Number.isFinite(version.latitude)
    || !Number.isFinite(version.longitude)
  ) {
    return null;
  }

  return haversineDistanceMetres(coordinates, {
    latitude: version.latitude,
    longitude: version.longitude,
  });
}

function toRadians(degrees: number) {
  return degrees * Math.PI / 180;
}
