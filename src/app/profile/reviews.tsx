import { useRouter } from 'expo-router';

import { authHref } from '@/lib/navigation';
import { MyReviewsScreen } from '@/screens/profile';

export default function MyReviewsRoute() {
  const router = useRouter();
  return (
    <MyReviewsScreen
      onBack={() => router.back()}
      onOpenVersion={(id) => router.push({ pathname: '/version/[id]', params: { id } })}
      onSignIn={() => router.push(authHref('login', '/profile/reviews'))}
    />
  );
}
