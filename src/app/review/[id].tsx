import { useLocalSearchParams, useRouter } from 'expo-router';

import { ReviewScreen } from '@/screens/details/ReviewScreen';

export default function ReviewRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <ReviewScreen
      versionId={id}
      onBack={() => router.back()}
      onPostReview={() => router.back()}
    />
  );
}
