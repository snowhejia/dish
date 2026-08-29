import { Redirect, useRouter } from 'expo-router';

import { RouteLoadingScreen } from '@/components/RouteLoadingScreen';
import { authHref } from '@/lib/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { useCatalog } from '@/providers/CatalogProvider';
import { AddVersionScreen } from '@/screens/details/AddVersionScreen';

export default function AddVersionRoute() {
  const router = useRouter();
  const { status } = useAuth();
  const { revision, submitContribution } = useCatalog();

  if (status === 'loading') return <RouteLoadingScreen />;
  if (status === 'guest') return <Redirect href={authHref('login', '/add')} />;

  return (
    <AddVersionScreen
      catalogRevision={revision}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/profile');
      }}
      onSubmit={async (draft) => {
        await submitContribution(draft);
      }}
      onSuccess={() => router.replace('/add/success')}
    />
  );
}
