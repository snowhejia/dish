import { useRouter } from 'expo-router';

import { DiscoverScreen } from '@/screens/tabs/DiscoverScreen';

export default function DiscoverRoute() {
  const router = useRouter();

  return (
    <DiscoverScreen
      onOpenCatalog={() => router.navigate('/catalog')}
      onOpenDish={(id) => router.push({ pathname: '/dish/[id]', params: { id } })}
    />
  );
}
