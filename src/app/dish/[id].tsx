import { useLocalSearchParams, useRouter } from 'expo-router';

import { DishBlockScreen } from '@/screens/details/DishBlockScreen';

export default function DishBlockRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <DishBlockScreen
      dishId={id}
      onBack={() => router.back()}
      onOpenCompare={(dishId, versionIds) =>
        router.push({
          pathname: '/compare/[id]',
          params: { id: dishId, versions: versionIds.join(',') },
        })
      }
      onOpenMap={(dishId) => router.push({ pathname: '/map/[id]', params: { id: dishId } })}
      onOpenVersion={(versionId) =>
        router.push({ pathname: '/version/[id]', params: { id: versionId } })
      }
    />
  );
}
