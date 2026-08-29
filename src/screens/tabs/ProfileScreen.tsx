import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Dishy } from '@/components/brand';
import { ChevronRightIcon, PlusIcon } from '@/components/icons';
import { BottomTabSpacer } from '@/components/tabs';
import { colors, radii, sizes, spacing } from '@/theme/tokens';

export type ProfileScreenProps = {
  onOpenAddVersion: () => void;
  onOpenSaved: () => void;
  onOpenReviews?: () => void;
  onOpenContributions?: () => void;
  onOpenNotifications?: () => void;
  onOpenAccountSettings?: () => void;
};

const PROFILE_STATS = [
  { value: '24', label: 'Reviews' },
  { value: '11', label: 'Photos' },
  { value: '3', label: 'Versions added' },
] as const;

export function ProfileScreen({
  onOpenAccountSettings,
  onOpenAddVersion,
  onOpenContributions,
  onOpenNotifications,
  onOpenReviews,
  onOpenSaved,
}: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const rows = [
    { label: 'My reviews', badge: null, onPress: onOpenReviews },
    { label: 'My contributions', badge: '1 pending', onPress: onOpenContributions },
    { label: 'Saved', badge: null, onPress: onOpenSaved },
    { label: 'Notifications', badge: null, onPress: onOpenNotifications },
    { label: 'Account settings', badge: null, onPress: onOpenAccountSettings },
  ];

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
      style={styles.screen}
    >
      <View style={[styles.identity, { paddingTop: Math.max(58, insets.top + spacing[11]) }]}>
        <View style={styles.avatar}>
          <Dishy size={46} variant="neutral" />
        </View>
        <View style={styles.identityCopy}>
          <Text style={styles.name}>Mei Chen</Text>
          <Text style={styles.joined}>Joined March 2026 · USYD</Text>
        </View>
      </View>

      <View style={styles.stats}>
        {PROFILE_STATS.map((stat) => (
          <View key={stat.label} style={styles.statCard}>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.addWrap}>
        <Pressable accessibilityRole="button" onPress={onOpenAddVersion} style={styles.addButton}>
          <PlusIcon color={colors.white} size={18} strokeWidth={1.9} />
          <View style={styles.addCopy}>
            <Text style={styles.addTitle}>Add a dish version</Text>
            <Text style={styles.addSubtitle}>Found something not on Dish. yet?</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.menu}>
        {rows.map((row) => (
          <Pressable
            accessibilityRole="button"
            disabled={!row.onPress}
            key={row.label}
            onPress={row.onPress}
            style={styles.menuRow}
          >
            <Text style={styles.menuLabel}>{row.label}</Text>
            {row.badge ? (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingLabel}>{row.badge}</Text>
              </View>
            ) : null}
            <ChevronRightIcon color={colors.iconMuted} size={13} strokeWidth={1.8} />
          </Pressable>
        ))}
      </View>
      <BottomTabSpacer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  identity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[14],
    paddingHorizontal: sizes.pageGutter,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.lavender,
    borderRadius: radii.large,
    height: 66,
    justifyContent: 'center',
    width: 66,
  },
  identityCopy: {
    flex: 1,
  },
  name: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  joined: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 16,
    marginTop: spacing[2],
  },
  stats: {
    flexDirection: 'row',
    gap: spacing[10],
    paddingHorizontal: sizes.pageGutter,
    paddingTop: spacing[18],
  },
  statCard: {
    backgroundColor: colors.softSurface,
    borderRadius: radii.button,
    flex: 1,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[13],
  },
  statValue: {
    color: colors.purpleDark,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 24,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 14.95,
    marginTop: spacing[3],
  },
  addWrap: {
    paddingHorizontal: sizes.pageGutter,
    paddingTop: spacing[20],
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: colors.purple,
    borderRadius: 15,
    flexDirection: 'row',
    gap: spacing[11],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[15],
  },
  addCopy: {
    flex: 1,
  },
  addTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 19,
  },
  addSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    lineHeight: 15,
    marginTop: spacing[2],
  },
  menu: {
    paddingBottom: spacing[26],
    paddingHorizontal: sizes.pageGutter,
    paddingTop: spacing[18],
  },
  menuRow: {
    alignItems: 'center',
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing[12],
    paddingVertical: spacing[15],
  },
  menuLabel: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 19,
  },
  pendingBadge: {
    backgroundColor: colors.pendingSurface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing[9],
    paddingVertical: spacing[4],
  },
  pendingLabel: {
    color: colors.pending,
    fontSize: 11.5,
    fontWeight: '600',
    lineHeight: 14,
  },
});
