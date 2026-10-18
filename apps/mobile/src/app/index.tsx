import { useAuth } from '@clerk/expo';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Laddoo } from '@/components/Laddoo';
import { PillButton } from '@/components/PillButton';
import { Txt } from '@/components/Txt';
import { WelcomeArt } from '@/scenes/WelcomeArt';
import { palette } from '@/theme/colors';

export default function Welcome() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const k = width / 340;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="welcome-sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={palette.sky.glow} />
            <Stop offset="0.3" stopColor="#EBCBAE" />
            <Stop offset="0.58" stopColor="#BFCBD1" />
            <Stop offset="0.7" stopColor="#9FB3C6" />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#welcome-sky)" />
      </Svg>

      <View style={{ position: 'absolute', bottom: 0, left: 0 }}>
        <WelcomeArt width={width} />
      </View>
      <View style={{ position: 'absolute', left: 22 * k, bottom: 112 * k + insets.bottom * 0.3 }}>
        <Laddoo size={150 * k} />
      </View>

      <View style={{ paddingTop: insets.top + 18, paddingHorizontal: 26 }}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Laddoo size={32} variant="head" animated={false} />
          </View>
          <Txt size={17} weight="bold" tight>
            Tagalong
          </Txt>
        </View>
        <Txt size={32} weight="bold" tight style={{ lineHeight: 36, marginTop: 28 }}>
          A travel buddy who never forgets
        </Txt>
        <Txt size={14} color={palette.cocoa} style={{ marginTop: 14, lineHeight: 22, maxWidth: 300 }}>
          Tell Laddoo how you like to travel, once. Every trip after that is planned around you: what to see, what to eat, and how to get there.
        </Txt>
      </View>

      <View style={[styles.cta, { bottom: Math.max(insets.bottom, 16) + 20 }]}>
        <PillButton variant="cream" label={isSignedIn ? 'Continue my trip' : 'Plan my first trip'} onPress={() => router.replace(isSignedIn ? '/today' : '/sign-in')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.sky.glow, overflow: 'hidden' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 38, height: 38, borderRadius: 19, backgroundColor: palette.cream, alignItems: 'center', justifyContent: 'center' },
  cta: { position: 'absolute', left: 24, right: 24 },
});
