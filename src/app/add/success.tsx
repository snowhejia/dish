import { useRouter } from 'expo-router';

import { ContributionSuccessScreen } from '@/screens/details/ContributionSuccessScreen';

export default function ContributionSuccessRoute() {
  const router = useRouter();

  return <ContributionSuccessScreen onDone={() => router.replace('/profile')} />;
}
