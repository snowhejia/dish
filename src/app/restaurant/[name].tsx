import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { RestaurantDetailScreen } from '@/screens/details/RestaurantDetailScreen';
import { versionById } from '@/data/mockData';
import { callPhone, openDirections } from '@/lib/directions';

export default function RestaurantDetailRoute() {
  const router = useRouter();
  const { name, version } = useLocalSearchParams<{ name: string; version?: string }>();

  const getDirections = async (versionId: string) => {
    const selectedVersion = versionById(versionId);
    if (!selectedVersion) return;
    try {
      await openDirections(selectedVersion);
    } catch (error) {
      Alert.alert('Could not open directions', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const callRestaurant = async (phone: string) => {
    try {
      await callPhone(phone);
    } catch (error) {
      Alert.alert('Could not start the call', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <RestaurantDetailScreen
      restaurantName={name}
      versionId={version}
      onBack={() => router.back()}
      onOpenVersion={(versionId) =>
        router.push({ pathname: '/version/[id]', params: { id: versionId } })
      }
      onGetDirections={(versionId) => void getDirections(versionId)}
      onCallPhone={(phone) => void callRestaurant(phone)}
    />
  );
}
