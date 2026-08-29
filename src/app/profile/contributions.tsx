import { useRouter } from 'expo-router';

import { authHref } from '@/lib/navigation';
import { MyContributionsScreen } from '@/screens/profile';

export default function MyContributionsRoute() {
  const router = useRouter();
  return (
    <MyContributionsScreen
      onBack={() => router.back()}
      onSignIn={() => router.push(authHref('login', '/profile/contributions'))}
    />
  );
}
