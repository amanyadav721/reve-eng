import { useAuth } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';

import { light } from '@/theme/colors';

/** Public screens. Signed-in travelers go straight to their day. */
export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  if (isSignedIn) return <Redirect href="/today" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: light.bg } }} />;
}
