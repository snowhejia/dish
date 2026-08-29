import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as Location from 'expo-location';

import type { Coordinates } from '@/lib/distance';

const DEFAULT_LOCATION_LABEL = 'USYD / Camperdown';

type LocationContextValue = {
  coordinates: Coordinates | null;
  locationLabel: string;
  isLocating: boolean;
  refreshLocation: () => Promise<void>;
};

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locationLabel, setLocationLabel] = useState(DEFAULT_LOCATION_LABEL);
  const [isLocating, setIsLocating] = useState(false);
  const locatingRef = useRef(false);

  const refreshLocation = useCallback(async () => {
    if (locatingRef.current) return;

    locatingRef.current = true;
    setIsLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) return;

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoordinates({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      const [address] = await Location.reverseGeocodeAsync(position.coords);
      if (address) setLocationLabel(formatLocationLabel(address));
    } catch {
      // Keep the campus label and catalog distance fallback when location is unavailable.
    } finally {
      locatingRef.current = false;
      setIsLocating(false);
    }
  }, []);

  useEffect(() => {
    void refreshLocation();
  }, [refreshLocation]);

  const value = useMemo<LocationContextValue>(() => ({
    coordinates,
    locationLabel,
    isLocating,
    refreshLocation,
  }), [coordinates, isLocating, locationLabel, refreshLocation]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const value = useContext(LocationContext);
  if (!value) throw new Error('useLocation must be used inside LocationProvider.');
  return value;
}

function formatLocationLabel(address: Location.LocationGeocodedAddress) {
  const primary = address.district ?? address.subregion ?? address.city ?? address.name;
  const secondary = address.city && address.city !== primary
    ? address.city
    : address.region && address.region !== primary
      ? address.region
      : null;
  const parts = [primary, secondary].filter((part): part is string => Boolean(part));
  return parts.slice(0, 2).join(' / ') || DEFAULT_LOCATION_LABEL;
}
