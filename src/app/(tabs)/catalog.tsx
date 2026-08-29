import { useRouter } from 'expo-router';

import { CatalogScreen } from '@/screens/tabs/CatalogScreen';

export default function CatalogRoute() {
  const router = useRouter();

  return (
    <CatalogScreen
      onOpenDish={(id) => router.push({ pathname: '/dish/[id]', params: { id } })}
      onOpenRestaurant={(name, version) => router.push({
        pathname: '/restaurant/[name]',
        params: { name, ...(version ? { version } : {}) },
      })}
    />
  );
}
