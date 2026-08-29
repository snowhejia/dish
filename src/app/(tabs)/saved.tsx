import { useRouter } from 'expo-router';

import { authHref } from '@/lib/navigation';
import { SavedScreen } from '@/screens/tabs/SavedScreen';

export default function SavedRoute() {
  const router = useRouter();

  return (
    <SavedScreen
      onBrowseDiscover={() => router.navigate('/')}
      onOpenDish={(id) => router.push({ pathname: '/dish/[id]', params: { id } })}
      onSignIn={() => router.push(authHref('login', '/saved'))}
      onOpenVersion={(id) => router.push({ pathname: '/version/[id]', params: { id } })}
    />
  );
}
