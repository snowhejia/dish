import { useRouter } from 'expo-router';

import { DiscoverScreen } from '@/screens/tabs/DiscoverScreen';

export default function DiscoverRoute() {
  const router = useRouter();

  return (
    <DiscoverScreen
      onOpenDish={(id) => router.push({ pathname: '/dish/[id]', params: { id } })}
    />
  );
}
