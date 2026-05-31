import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ServerForm } from '@/components/server-form';

export default function NewServerScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ServerForm onSaved={() => router.back()} />
    </SafeAreaView>
  );
}
