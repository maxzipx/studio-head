import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { colors } from '@/src/ui/tokens';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown:            false,
        tabBarShowLabel:        false,
        tabBarActiveTintColor:  colors.navyPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopWidth:  0,
          borderWidth:     1,
          borderColor:     colors.borderDefault,
          marginHorizontal: 24,
          marginBottom:    Platform.OS === 'ios' ? 24 : 10,
          borderRadius:    32,
          height:          60,
          shadowColor:     '#1A0E06',
          shadowOffset:    { width: 0, height: 6 },
          shadowOpacity:   0.50,
          shadowRadius:    16,
          elevation:       10,
        },
        tabBarItemStyle: {
          paddingVertical: 8,
        },
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'HQ',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <IconSymbol size={24} name="building.2.fill" color={color} />
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
              <IconSymbol size={24} name="film.fill" color={color} />
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen name="script-room"   options={{ href: null }} />
      <Tabs.Screen name="distribution"  options={{ href: null }} />
      <Tabs.Screen name="box-office"    options={{ href: null }} />
      <Tabs.Screen name="inbox"         options={{ href: null }} />
      <Tabs.Screen name="explore"       options={{ href: null }} />
      <Tabs.Screen
        name="talent"
        options={{
          title: 'Talent',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <IconSymbol size={24} name="person.2.fill" color={color} />
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
              <IconSymbol size={24} name="dollarsign.circle.fill" color={color} />
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
    width:           20,
    height:          3,
    borderRadius:    2,
    backgroundColor: colors.navyPrimary,
  },
});
