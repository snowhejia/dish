import { useLocalSearchParams, useRouter } from 'expo-router';

import { RestaurantDetailScreen } from '@/screens/details/RestaurantDetailScreen';

export default function RestaurantDetailRoute() {
  const router = useRouter();
  const { name, version } = useLocalSearchParams<{ name: string; version?: string }>();

  return (
    <RestaurantDetailScreen
      restaurantName={name}
      versionId={version}
      onBack={() => router.back()}
      onOpenVersion={(versionId) =>
        router.push({ pathname: '/version/[id]', params: { id: versionId } })
      }
    />
  );
}
