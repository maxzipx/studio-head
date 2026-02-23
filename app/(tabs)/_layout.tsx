import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { tokens } from '@/src/ui/tokens';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: tokens.accentGold,
        tabBarInactiveTintColor: tokens.textMuted,
        tabBarStyle: {
          backgroundColor: tokens.bgSurface,
          borderTopColor: tokens.border,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          paddingTop: 8,
        },
        headerStyle: { backgroundColor: tokens.bgSurface },
        headerTintColor: tokens.textPrimary,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'HQ',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="building.2.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="slate"
        options={{
          title: 'Slate',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="film.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="script-room"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="distribution"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="box-office"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="talent"
        options={{
          title: 'Talent',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.2.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="financials"
        options={{
          title: 'Financials',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="dollarsign.circle.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
