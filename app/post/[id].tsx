import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { PostDetail } from '@/components/post-detail';

export default function PostScreen() {
  const params = useLocalSearchParams<{ id: string; serverId?: string }>();
  const router = useRouter();
  return (
    <>
      {/* PostDetail provides its own full-width left→right swipe-to-dismiss, so
          turn off the native edge-swipe to avoid the two double-firing. */}
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <PostDetail postId={params.id} serverId={params.serverId} onBack={() => router.back()} />
    </>
  );
}
