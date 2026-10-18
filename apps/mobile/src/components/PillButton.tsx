import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Platform, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { light, palette } from '@/theme/colors';
import { Txt } from './Txt';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  label?: string;
  children?: ReactNode;
  variant?: 'ink' | 'cream' | 'chip';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

const variants = {
  ink: { bg: light.primary, fg: light.onPrimary },
  cream: { bg: '#F6E7C8', fg: palette.ink },
  chip: { bg: palette.sand, fg: palette.ink },
};

/** The app's one main button shape: a pill that springs down when pressed. */
export function PillButton({ label, children, variant = 'ink', onPress, style, accessibilityLabel }: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const v = variants[variant];

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPressIn={() => (scale.value = withSpring(0.96, { damping: 14, stiffness: 400 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 10, stiffness: 300 }))}
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress?.();
      }}
      style={[
        {
          backgroundColor: v.bg,
          borderRadius: 999,
          paddingVertical: 16,
          paddingHorizontal: 20,
          alignItems: 'center',
          justifyContent: 'center',
        },
        variant === 'cream' && { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } },
        style,
        animated,
      ]}
    >
      {children ?? (
        <Txt size={16} weight="semibold" color={v.fg}>
          {label}
        </Txt>
      )}
    </AnimatedPressable>
  );
}
