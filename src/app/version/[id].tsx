import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { VersionDetailScreen } from '@/screens/details/VersionDetailScreen';
import { versionById } from '@/data/mockData';
import { openDirections } from '@/lib/directions';
import { authHref, returnPath } from '@/lib/navigation';

export default function VersionDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const getDirections = async (versionId: string) => {
    const selectedVersion = versionById(versionId);
    if (!selectedVersion) return;
    try {
      await openDirections(selectedVersion);
    } catch (error) {
      Alert.alert('Could not open directions', error instanceof Error ? error.message : 'Please try again.');
    }
  };

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
      onGetDirections={(versionId) => void getDirections(versionId)}
      onSignIn={() => router.push(authHref('login', returnPath('version', id)))}
    />
  );
}
