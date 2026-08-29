import { useRouter } from 'expo-router';

import { authHref } from '@/lib/navigation';
import { useCatalog } from '@/providers/CatalogProvider';
import { MyVersionsAddedScreen } from '@/screens/profile';

export default function MyVersionsAddedRoute() {
  const router = useRouter();
  const { refreshCatalog } = useCatalog();

  const openVersion = (id: string) => {
    void refreshCatalog().finally(() => {
      router.push({ pathname: '/version/[id]', params: { id } });
    });
  };

  return (
    <MyVersionsAddedScreen
      onBack={() => router.back()}
      onOpenVersion={openVersion}
      onSignIn={() => router.push(authHref('login', '/profile/versions'))}
    />
  );
}
