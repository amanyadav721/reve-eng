import { useAuth } from '@clerk/expo';
import { Redirect, Tabs } from 'expo-router';

import { TabBar } from '@/components/TabBar';
import { light } from '@/theme/colors';

export default function TabLayout() {
  // Trips, memories and the map belong to a signed-in traveler.
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/sign-in" />;

  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: light.bg } }}>
      <Tabs.Screen name="today" options={{ title: 'Today' }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
      <Tabs.Screen name="laddoo" options={{ title: 'Laddoo' }} />
      <Tabs.Screen name="passport" options={{ title: 'Passport' }} />
      <Tabs.Screen name="me" options={{ title: 'Me' }} />
    </Tabs>
  );
}
