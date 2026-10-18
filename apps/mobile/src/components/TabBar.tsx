import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { palette } from '@/theme/colors';
import { Txt } from './Txt';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

function Icon({ name, active }: { name: string; active: boolean }) {
  const color = active ? palette.ink : palette.dune;
  const common = { fill: active ? color : 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      {name === 'today' && <Path {...common} d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />}
      {name === 'explore' && (
        <>
          <Circle {...common} cx="12" cy="12" r="9" />
          <Path {...common} fill={active ? palette.peach : 'none'} d="m15.5 8.5-2 5-5 2 2-5z" />
        </>
      )}
      {name === 'laddoo' && <Path {...common} d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />}
      {name === 'passport' && (
        <>
          <Rect {...common} x="5" y="3" width="14" height="18" rx="2" />
          <Circle {...common} fill="none" stroke={active ? palette.peach : color} cx="12" cy="10" r="3" />
          <Path {...common} stroke={active ? palette.peach : color} d="M9 16h6" />
        </>
      )}
      {name === 'me' && (
        <>
          <Circle {...common} cx="12" cy="8" r="4" />
          <Path {...common} d="M4 21a8 8 0 0 1 16 0" />
        </>
      )}
    </Svg>
  );
}

/** Peach, blurred-looking bar with ink for the active tab, as in the mockup. */
export function TabBar({ state, descriptors, emitter, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {state.routes.map((route, index) => {
        const active = state.index === index;
        const label = descriptors[route.key].options.title ?? route.name;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
            onPress={() => {
              const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!active && !event.defaultPrevented) navigateToTab(route.key);
            }}
            style={styles.tab}
          >
            <Icon name={route.name} active={active} />
            <Txt size={11.5} weight={active ? 'bold' : 'medium'} color={active ? palette.ink : palette.dune}>
              {label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    backgroundColor: palette.peach,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(110,81,66,0.2)',
  },
  tab: { alignItems: 'center', gap: 4, minWidth: 60 },
});
