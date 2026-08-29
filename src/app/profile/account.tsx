import { useRouter } from 'expo-router';

import { authHref } from '@/lib/navigation';
import { AccountSettingsScreen } from '@/screens/profile';

export default function AccountSettingsRoute() {
  const router = useRouter();
  return (
    <AccountSettingsScreen
      onBack={() => router.back()}
      onSignIn={() => router.push(authHref('login', '/profile/account'))}
    />
  );
}
