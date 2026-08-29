import { useLocalSearchParams, useRouter } from 'expo-router';

import { VersionDetailScreen } from '@/screens/details/VersionDetailScreen';

export default function VersionDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <VersionDetailScreen
      versionId={id}
      onBack={() => router.back()}
      onOpenRestaurant={(name) =>
        router.push({ pathname: '/restaurant/[name]', params: { name, version: id } })
      }
      onOpenReview={(versionId) =>
        router.push({ pathname: '/review/[id]', params: { id: versionId } })
      }
      onOpenVersion={(versionId) =>
        router.push({ pathname: '/version/[id]', params: { id: versionId } })
      }
      onSeeAllVersions={(dishId) =>
        router.push({ pathname: '/dish/[id]', params: { id: dishId } })
      }
    />
  );
}
