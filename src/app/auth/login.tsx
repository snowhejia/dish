import { useLocalSearchParams, useRouter } from 'expo-router';

import { authHref, safeReturnHref } from '@/lib/navigation';
import { LoginScreen } from '@/screens/auth';

export default function LoginRoute() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const destination = safeReturnHref(returnTo);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  };

  return (
    <LoginScreen
      onAuthenticated={() => router.replace(destination)}
      onBack={close}
      onSwitchMode={() => router.replace(authHref('register', returnTo))}
    />
  );
}
