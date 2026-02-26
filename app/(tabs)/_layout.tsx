import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { blur, colors, typography } from '@/src/ui/tokens';

// Glassmorphism tab bar background (iOS only)
function TabBarBackground() {
  if (Platform.OS !== 'ios') return null;
  return (
    <BlurView
      intensity={blur.tabBar}
      tint="dark"
      style={StyleSheet.absoluteFill}
    />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   colors.goldMid,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontFamily:    typography.fontBodyMedium,
          fontSize:      10,
          letterSpacing: typography.trackingWide,
          marginTop:     2,
        },
        tabBarStyle: {
          // Transparent so the BlurView shows through on iOS
          backgroundColor: Platform.OS === 'ios'
            ? 'rgba(8,10,15,0.65)'
            : colors.bgSurface,
          borderTopWidth:  1,
          borderTopColor:  colors.borderSubtle,
          height:          Platform.OS === 'ios' ? 88 : 64,
          paddingBottom:   Platform.OS === 'ios' ? 24 : 8,
          paddingTop:      8,
        },
        tabBarBackground: Platform.OS === 'ios' ? TabBarBackground : undefined,
        headerStyle: {
          backgroundColor: colors.bgPrimary,
        },
        headerShadowVisible: false,
        headerTitleStyle: {
          fontFamily: typography.fontDisplay,
          fontSize:   typography.sizeMD,
          color:      colors.textPrimary,
        },
        headerTintColor: colors.textPrimary,
        tabBarButton:    HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'HQ',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <IconSymbol size={22} name="building.2.fill" color={color} />
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="slate"
        options={{
          title: 'Slate',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <IconSymbol size={22} name="film.fill" color={color} />
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen name="script-room"   options={{ href: null }} />
      <Tabs.Screen name="distribution"  options={{ href: null }} />
      <Tabs.Screen name="box-office"    options={{ href: null }} />
      <Tabs.Screen name="inbox"         options={{ href: null }} />
      <Tabs.Screen
        name="talent"
        options={{
          title: 'Talent',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <IconSymbol size={22} name="person.2.fill" color={color} />
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="financials"
        options={{
          title: 'Financials',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <IconSymbol size={22} name="dollarsign.circle.fill" color={color} />
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeIconWrap: {
    alignItems: 'center',
    gap:        3,
  },
  activeDot: {
    width:           4,
    height:          4,
    borderRadius:    2,
    backgroundColor: colors.goldMid,
  },
});
