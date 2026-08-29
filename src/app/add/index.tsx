import { useRouter } from 'expo-router';

import { AddVersionScreen } from '@/screens/details/AddVersionScreen';

export default function AddVersionRoute() {
  const router = useRouter();

  return (
    <AddVersionScreen
      onBack={() => router.back()}
      onSuccess={() => router.replace('/add/success')}
    />
  );
}
