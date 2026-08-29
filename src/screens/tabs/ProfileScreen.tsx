import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Dishy } from '@/components/brand';
import { ChevronRightIcon, PlusIcon } from '@/components/icons';
import { BottomTabSpacer } from '@/components/tabs';
import { useAuth } from '@/providers/AuthProvider';
import { colors, radii, sizes, spacing } from '@/theme/tokens';

export type ProfileScreenProps = {
  onOpenAddVersion: () => void;
  onOpenReviews: () => void;
  onOpenContributions: () => void;
  onOpenNotifications: () => void;
  onOpenAccountSettings: () => void;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
};

export function ProfileScreen({
  onOpenAccountSettings,
  onOpenAddVersion,
  onOpenContributions,
  onOpenNotifications,
  onOpenReviews,
  onOpenLogin,
  onOpenRegister,
}: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const { logout, status, user } = useAuth();
  const rows = [
    {
      label: 'My contributions',
      onPress: onOpenContributions,
      badge: user?.stats?.pendingContributions ? `${user.stats.pendingContributions} pending` : undefined,
    },
    { label: 'Notifications', onPress: onOpenNotifications },
    { label: 'Account settings', onPress: onOpenAccountSettings },
  ];

  if (status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.purple} />
      </View>
    );
  }

  if (status === 'guest' || !user) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={styles.guestContent}
        showsVerticalScrollIndicator={false}
        style={styles.screen}
      >
        <View style={[styles.guestHero, { paddingTop: Math.max(70, insets.top + spacing[20]) }]}>
          <View style={styles.guestMascot}>
            <Dishy size={72} variant="neutral" />
          </View>
          <Text style={styles.guestTitle}>Your Dish. profile</Text>
          <Text style={styles.guestBody}>
            Sign in to keep saved food, reviews and contribution updates connected to you.
          </Text>
        </View>

        <View style={styles.authCard}>
          <Pressable accessibilityRole="button" onPress={onOpenLogin} style={styles.signInButton}>
            <Text style={styles.signInLabel}>Sign in</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onOpenRegister} style={styles.registerButton}>
            <Text style={styles.registerLabel}>Create account</Text>
          </Pressable>
          <Text style={styles.guestHint}>You can keep browsing Discover and Catalog without an account.</Text>
        </View>
        <BottomTabSpacer />
      </ScrollView>
    );
  }

  const stats = [
    { label: 'Reviews', value: user.stats?.reviews ?? 0, onPress: onOpenReviews },
    { label: 'Photos', value: user.stats?.photos ?? 0, onPress: undefined },
    { label: 'Versions added', value: user.stats?.versionsAdded ?? 0, onPress: undefined },
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
          <Text style={styles.name}>{user.displayName}</Text>
          <Text numberOfLines={1} style={styles.email}>{user.email}</Text>
          <Text style={styles.joined}>{accountMeta(user.createdAt, user.role, user.campus)}</Text>
        </View>
      </View>

      <View style={styles.stats}>
        {stats.map((stat) => {
          const content = (
            <>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </>
          );
          return stat.onPress ? (
            <Pressable
              accessibilityHint="Opens your review history"
              accessibilityLabel={`${stat.value} reviews`}
              accessibilityRole="button"
              key={stat.label}
              onPress={stat.onPress}
              style={({ pressed }) => [styles.statCard, pressed && styles.statCardPressed]}
            >
              {content}
            </Pressable>
          ) : (
            <View key={stat.label} style={styles.statCard}>{content}</View>
          );
        })}
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
            key={row.label}
            onPress={row.onPress}
            style={styles.menuRow}
          >
            <Text style={styles.menuLabel}>{row.label}</Text>
            {'badge' in row && row.badge ? <Text style={styles.menuBadge}>{row.badge}</Text> : null}
            <ChevronRightIcon color={colors.iconMuted} size={13} strokeWidth={1.8} />
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" onPress={() => void logout().catch(() => undefined)} style={styles.logoutRow}>
          <Text style={styles.logoutLabel}>Sign out</Text>
        </Pressable>
      </View>
      <BottomTabSpacer />
    </ScrollView>
  );
}

function accountMeta(createdAt: string | undefined, role: string, campus: string | null) {
  const roleLabel = role.toLowerCase() === 'admin' ? 'Admin' : 'Diner';
  const suffix = campus ? `${roleLabel} · ${campus}` : roleLabel;
  if (!createdAt) return suffix;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return suffix;
  const joined = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date);
  return `Joined ${joined} · ${suffix}`;
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  loading: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    flex: 1,
    justifyContent: 'center',
  },
  guestContent: {
    flexGrow: 1,
  },
  guestHero: {
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  guestMascot: {
    alignItems: 'center',
    backgroundColor: colors.lavender,
    borderRadius: radii.large,
    height: 92,
    justifyContent: 'center',
    width: 92,
  },
  guestTitle: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 28,
    marginTop: spacing[18],
    textAlign: 'center',
  },
  guestBody: {
    color: colors.muted,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: spacing[7],
    maxWidth: 330,
    textAlign: 'center',
  },
  authCard: {
    gap: spacing[10],
    paddingHorizontal: sizes.pageGutter,
    paddingTop: spacing[24],
  },
  signInButton: {
    alignItems: 'center',
    backgroundColor: colors.purple,
    borderRadius: radii.button,
    justifyContent: 'center',
    minHeight: 50,
  },
  signInLabel: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
  },
  registerButton: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: radii.button,
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 50,
  },
  registerLabel: {
    color: colors.purpleDark,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
  },
  guestHint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing[6],
    textAlign: 'center',
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
  email: {
    color: colors.body,
    fontSize: 12.5,
    lineHeight: 16,
    marginTop: spacing[2],
  },
  joined: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: spacing[2],
  },
  addWrap: {
    paddingHorizontal: sizes.pageGutter,
    paddingTop: spacing[20],
  },
  stats: {
    flexDirection: 'row',
    gap: spacing[8],
    paddingHorizontal: sizes.pageGutter,
    paddingTop: spacing[18],
  },
  statCard: {
    alignItems: 'center',
    backgroundColor: colors.softSurface,
    borderRadius: radii.control,
    flex: 1,
    minHeight: 70,
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
  },
  statCardPressed: {
    opacity: 0.7,
  },
  statValue: {
    color: colors.purpleDark,
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 23,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: spacing[2],
    textAlign: 'center',
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
  menuBadge: {
    backgroundColor: colors.chipSurface,
    borderRadius: radii.pill,
    color: colors.purpleDark,
    fontSize: 10.5,
    fontWeight: '600',
    lineHeight: 14,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[3],
  },
  logoutRow: {
    alignItems: 'center',
    minHeight: 52,
    paddingTop: spacing[16],
  },
  logoutLabel: {
    color: '#A33232',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
});
