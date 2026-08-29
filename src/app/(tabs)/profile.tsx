import { useRouter } from 'expo-router';

import { authHref } from '@/lib/navigation';
import { ProfileScreen } from '@/screens/tabs/ProfileScreen';

export default function ProfileRoute() {
  const router = useRouter();

  return (
    <ProfileScreen
      onOpenAddVersion={() => router.push('/add')}
      onOpenAccountSettings={() => router.push('/profile/account')}
      onOpenContributions={() => router.push('/profile/contributions')}
      onOpenLogin={() => router.push(authHref('login'))}
      onOpenNotifications={() => router.push('/profile/notifications')}
      onOpenRegister={() => router.push(authHref('register'))}
      onOpenReviews={() => router.push('/profile/reviews')}
    />
  );
}
