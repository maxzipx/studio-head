import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { colors, typography } from '@/src/ui/tokens';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   colors.navyPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontFamily:    typography.fontBodyMedium,
          fontSize:      10,
          letterSpacing: typography.trackingWide,
          marginTop:     2,
        },
        tabBarStyle: {
          backgroundColor: colors.bgSurface,
          borderTopWidth:  1,
          borderTopColor:  colors.borderSubtle,
          height:          Platform.OS === 'ios' ? 88 : 64,
          paddingBottom:   Platform.OS === 'ios' ? 24 : 8,
          paddingTop:      8,
        },
        headerStyle: {
          backgroundColor: colors.bgSurface,
        },
        headerShadowVisible: false,
        headerTitleStyle: {
          fontFamily: typography.fontDisplay,
          fontSize:   typography.sizeMD,
          color:      colors.navyPrimary,
        },
        headerTintColor: colors.navyPrimary,
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
    backgroundColor: colors.navyPrimary,
  },
});
