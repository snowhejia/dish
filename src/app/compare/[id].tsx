import { useLocalSearchParams, useRouter } from 'expo-router';

import { CompareScreen } from '@/screens/details/CompareScreen';

export default function CompareRoute() {
  const router = useRouter();
  const { id, versions } = useLocalSearchParams<{ id: string; versions?: string }>();
  const versionIds = versions?.split(',').filter(Boolean);

  return (
    <CompareScreen
      dishId={id}
      versionIds={versionIds}
      onBack={() => router.back()}
      onOpenVersion={(versionId) =>
        router.push({ pathname: '/version/[id]', params: { id: versionId } })
      }
    />
  );
}
