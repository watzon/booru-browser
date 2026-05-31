import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ServerForm } from '@/components/server-form';

export default function EditServerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ServerForm initialId={id} onSaved={() => router.back()} />
    </SafeAreaView>
  );
}
