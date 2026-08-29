import { useRouter } from 'expo-router';

import { CatalogScreen } from '@/screens/tabs/CatalogScreen';

export default function CatalogRoute() {
  const router = useRouter();

  return (
    <CatalogScreen
      onOpenDish={(id) => router.push({ pathname: '/dish/[id]', params: { id } })}
      onOpenVersion={(id) => router.push({ pathname: '/version/[id]', params: { id } })}
    />
  );
}
