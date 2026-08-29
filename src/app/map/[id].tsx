import { useLocalSearchParams, useRouter } from 'expo-router';

import { DishMapScreen } from '@/screens/details/DishMapScreen';

export default function DishMapRoute() {
  const router = useRouter();
  const { id, version } = useLocalSearchParams<{ id: string; version?: string }>();

  return (
    <DishMapScreen
      dishId={id}
      initialVersionId={version}
      onBack={() => router.back()}
      onOpenVersion={(versionId) =>
        router.push({ pathname: '/version/[id]', params: { id: versionId } })
      }
    />
  );
}
