import { useRouter } from 'expo-router';

import { authHref } from '@/lib/navigation';
import { NotificationsScreen } from '@/screens/profile';

export default function NotificationsRoute() {
  const router = useRouter();
  return (
    <NotificationsScreen
      onBack={() => router.back()}
      onSignIn={() => router.push(authHref('login', '/profile/notifications'))}
    />
  );
}
