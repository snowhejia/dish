import { useRouter } from 'expo-router';

import { ProfileScreen } from '@/screens/tabs/ProfileScreen';

export default function ProfileRoute() {
  const router = useRouter();

  return (
    <ProfileScreen
      onOpenAddVersion={() => router.push('/add')}
      onOpenAccountSettings={() => {}}
      onOpenContributions={() => {}}
      onOpenNotifications={() => {}}
      onOpenReviews={() => {}}
      onOpenSaved={() => router.navigate('/saved')}
    />
  );
}
