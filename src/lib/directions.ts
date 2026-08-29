import { Linking, Platform } from 'react-native';

type Destination = {
  restaurant?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
};

export async function openDirections(destination: Destination) {
  const coordinate = destination.latitude != null && destination.longitude != null
    ? `${destination.latitude},${destination.longitude}`
    : null;
  const query = coordinate ?? destination.address ?? destination.restaurant;
  if (!query) throw new Error('This restaurant does not have an address yet.');

  const encoded = encodeURIComponent(query);
  const nativeUrl = Platform.select({
    ios: `maps://?daddr=${encoded}`,
    android: coordinate ? `geo:0,0?q=${encoded}` : `geo:0,0?q=${encoded}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${encoded}`,
  })!;
  const fallback = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
  const canOpenNative = Platform.OS === 'web' ? true : await Linking.canOpenURL(nativeUrl);
  await Linking.openURL(canOpenNative ? nativeUrl : fallback);
}

export async function callPhone(phone: string) {
  const normalized = phone.replace(/[^+\d]/g, '');
  if (!normalized) throw new Error('This restaurant does not have a valid phone number.');
  await Linking.openURL(`tel:${normalized}`);
}
