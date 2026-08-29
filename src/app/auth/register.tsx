import { useLocalSearchParams, useRouter } from 'expo-router';

import { authHref, safeReturnHref } from '@/lib/navigation';
import { RegisterScreen } from '@/screens/auth';

export default function RegisterRoute() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const destination = safeReturnHref(returnTo);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  };

  return (
    <RegisterScreen
      onAuthenticated={() => router.replace(destination)}
      onBack={close}
      onSwitchMode={() => router.replace(authHref('login', returnTo))}
    />
  );
}
