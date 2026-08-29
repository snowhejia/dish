import { useMemo, useState } from 'react';
import { useIsFocused } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Dishy } from '@/components/brand';
import { BottomTabSpacer, SavedCard, SegmentedControl } from '@/components/tabs';
import { fallbackFoodImage, foodImages } from '@/data/images';
import { money, versionMenuName } from '@/data/mockData';
import { apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import { useCatalog } from '@/providers/CatalogProvider';
import { colors, radii, sizes, spacing } from '@/theme/tokens';

type SavedTab = 'dishes' | 'versions';

const SEGMENTS = [
  { label: 'Dishes', value: 'dishes' },
  { label: 'Versions', value: 'versions' },
] as const;

export type SavedScreenProps = {
  onOpenDish: (dishId: string) => void;
  onOpenVersion: (versionId: string) => void;
  onBrowseDiscover: () => void;
  onSignIn: () => void;
};

export function SavedScreen({ onBrowseDiscover, onOpenDish, onOpenVersion, onSignIn }: SavedScreenProps) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { status } = useAuth();
  const {
    refreshSaved,
    savedDishIds,
    savedError,
    savedLoading,
    savedVersionIds,
    snapshot,
    toggleSaved,
  } = useCatalog();
  const [tab, setTab] = useState<SavedTab>('dishes');
  const [removingId, setRemovingId] = useState<string>();
  const [removeError, setRemoveError] = useState<string>();

  const rows = useMemo(() => {
    if (tab === 'dishes') {
      return Array.from(savedDishIds).flatMap((dishId) => {
        const dish = snapshot.dishes.find((item) => item.id === dishId);
        if (!dish) return [];
        const dishVersions = snapshot.versions.filter((version) => version.dishId === dish.id);
        const firstVersion = dishVersions[0];
        return [{
          key: dishId,
          kind: 'DISH' as const,
          image: firstVersion ? foodImages[firstVersion.id] ?? fallbackFoodImage : fallbackFoodImage,
          title: dish.name,
          subtitle: `${dishVersions.length} ${dishVersions.length === 1 ? 'version near you' : 'versions near you'}`,
          onPress: () => onOpenDish(dish.id),
        }];
      });
    }

    return Array.from(savedVersionIds).flatMap((savedId) => {
      const version = snapshot.versions.find((item) => item.id === savedId);
      if (!version) return [];
      return [{
        key: savedId,
        kind: 'VERSION' as const,
        image: foodImages[version.id] ?? fallbackFoodImage,
        title: versionMenuName(version),
        subtitle: `${version.restaurant} · ${money(version.price)} · ${version.wouldEatAgain}%`,
        onPress: () => onOpenVersion(version.id),
      }];
    });
  }, [onOpenDish, onOpenVersion, savedDishIds, savedVersionIds, snapshot, tab]);

  const hint =
    tab === 'dishes'
      ? 'Dishes you want to keep exploring — every restaurant version stays in one place.'
      : 'One dish at one restaurant. The exact bowl you want to find again.';

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      scrollsToTop={isFocused}
      showsVerticalScrollIndicator={false}
      style={styles.screen}
    >
      <View style={[styles.header, { paddingTop: Math.max(58, insets.top + spacing[11]) }]}>
        <Text style={styles.title}>Saved</Text>
        <SegmentedControl onChange={setTab} options={SEGMENTS} style={styles.segments} value={tab} />
        <Text style={styles.hint}>{hint}</Text>
      </View>

      {status === 'loading' || (savedLoading && !rows.length) ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.purple} />
        </View>
      ) : status === 'guest' ? (
        <View style={styles.empty}>
          <Dishy size={86} variant="saved" />
          <Text style={styles.emptyTitle}>Sign in to keep your saves</Text>
          <Text style={styles.emptyBody}>
            Your saved dishes and exact restaurant versions stay connected to your account.
          </Text>
          <Pressable accessibilityRole="button" onPress={onSignIn} style={styles.browseButton}>
            <Text style={styles.browseLabel}>Sign in</Text>
          </Pressable>
        </View>
      ) : savedError && !rows.length ? (
        <View style={styles.empty}>
          <Dishy size={86} variant="neutral" />
          <Text style={styles.emptyTitle}>Could not load Saved</Text>
          <Text accessibilityRole="alert" style={styles.emptyBody}>{savedError}</Text>
          <Pressable accessibilityRole="button" onPress={() => void refreshSaved().catch(() => undefined)} style={styles.browseButton}>
            <Text style={styles.browseLabel}>Try again</Text>
          </Pressable>
        </View>
      ) : rows.length ? (
        <View style={styles.list}>
          {removeError || savedError ? <Text accessibilityRole="alert" style={styles.error}>{removeError ?? savedError}</Text> : null}
          {rows.map((row) => (
            <SavedCard
              image={row.image}
              key={row.key}
              kind={row.kind}
              onPress={row.onPress}
              onRemove={() => {
                if (removingId) return;
                setRemovingId(row.key);
                setRemoveError(undefined);
                void toggleSaved(row.kind === 'DISH' ? 'dish' : 'version', row.key)
                  .catch((error) => setRemoveError(apiErrorMessage(error, 'Could not remove this saved item.')))
                  .finally(() => setRemovingId(undefined));
              }}
              subtitle={row.subtitle}
              title={row.title}
            />
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <Dishy size={86} variant="saved" />
          <Text style={styles.emptyTitle}>Nothing saved here yet</Text>
          <Text style={styles.emptyBody}>
            Save a dish to keep exploring its versions, or a version to find that exact bowl again.
          </Text>
          <Pressable accessibilityRole="button" onPress={onBrowseDiscover} style={styles.browseButton}>
            <Text style={styles.browseLabel}>Browse Discover</Text>
          </Pressable>
        </View>
      )}
      <BottomTabSpacer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  header: {
    paddingHorizontal: sizes.pageGutter,
  },
  loading: {
    alignItems: 'center',
    minHeight: 220,
    justifyContent: 'center',
  },
  title: {
    color: colors.ink,
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: -0.7,
    lineHeight: 32,
  },
  segments: {
    marginTop: spacing[14],
  },
  hint: {
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 18.125,
    marginTop: spacing[12],
  },
  list: {
    gap: spacing[11],
    paddingBottom: spacing[26],
    paddingHorizontal: sizes.pageGutter,
    paddingTop: spacing[16],
  },
  error: {
    backgroundColor: '#FFF0F0',
    borderRadius: radii.control,
    color: '#A33232',
    fontSize: 12.5,
    lineHeight: 18,
    paddingHorizontal: spacing[13],
    paddingVertical: spacing[10],
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 34,
    paddingTop: 44,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 23,
    marginTop: spacing[18],
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.muted,
    fontSize: 13.5,
    lineHeight: 20.25,
    marginTop: spacing[7],
    textAlign: 'center',
  },
  browseButton: {
    backgroundColor: colors.purple,
    borderRadius: 13,
    marginTop: spacing[20],
    paddingHorizontal: spacing[24],
    paddingVertical: spacing[13],
  },
  browseLabel: {
    color: colors.white,
    fontSize: 14.5,
    fontWeight: '600',
    lineHeight: 18,
  },
});
