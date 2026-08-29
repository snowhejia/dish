import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { RouteLoadingScreen } from '@/components/RouteLoadingScreen';
import { authHref, returnPath } from '@/lib/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { useCatalog } from '@/providers/CatalogProvider';
import { ReviewScreen } from '@/screens/details/ReviewScreen';

export default function ReviewRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status } = useAuth();
  const { submitReview } = useCatalog();
  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/version/[id]', params: { id } });
  };

  if (status === 'loading') return <RouteLoadingScreen />;
  if (status === 'guest') return <Redirect href={authHref('login', returnPath('review', id))} />;

  return (
    <ReviewScreen
      versionId={id}
      onBack={close}
      onPostReview={async (submission) => {
        await submitReview({
          versionId: submission.versionId,
          yes: submission.verdict === 'YES',
          text: submission.text,
          pricePaid: submission.pricePaid,
          photo: submission.photo,
        });
        close();
      }}
    />
  );
}
