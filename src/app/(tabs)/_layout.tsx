import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CatalogTabIcon,
  DiscoverTabIcon,
  ProfileTabIcon,
  SavedTabIcon,
} from '@/components/icons';
import { colors } from '@/theme/tokens';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(22, insets.bottom);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.purple,
        tabBarInactiveTintColor: colors.inactive,
        tabBarHideOnKeyboard: true,
        tabBarStyle: [
          styles.tabBar,
          {
            height: 50 + bottomPadding,
            paddingBottom: bottomPadding,
          },
        ],
        tabBarBackground: () => (
          <BlurView intensity={92} tint="light" style={StyleSheet.absoluteFill} />
        ),
        tabBarLabelStyle: styles.label,
        tabBarIconStyle: styles.icon,
        tabBarLabelPosition: 'below-icon',
        tabBarButton: ({ children, href: _href, ref: _ref, style, ...props }) => (
          <Pressable {...props} style={[style, styles.tabButton]}>
            {children}
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color }) => <DiscoverTabIcon color={String(color)} size={23} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          title: 'Catalog',
          tabBarIcon: ({ color }) => <CatalogTabIcon color={String(color)} size={23} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          tabBarIcon: ({ color }) => <SavedTabIcon color={String(color)} size={23} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <ProfileTabIcon color={String(color)} size={23} strokeWidth={1.8} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderTopColor: colors.borderSoft,
    borderTopWidth: 1,
    elevation: 0,
    paddingHorizontal: 8,
    paddingTop: 9,
    position: 'absolute',
  },
  icon: {
    height: 23,
    marginBottom: 5,
    width: 23,
  },
  label: {
    flexShrink: 0,
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: -0.1,
    lineHeight: 13,
  },
  tabButton: {
    gap: 0,
    outlineColor: 'transparent',
    outlineStyle: 'solid',
    outlineWidth: 0,
    padding: 0,
  },
});
