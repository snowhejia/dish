import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Dishy } from '@/components/brand';
import { BottomTabSpacer, SavedCard, SegmentedControl } from '@/components/tabs';
import { foodImages } from '@/data/images';
import { dishById, dishForVersion, money, versionById, versionsOfDish } from '@/data/mockData';
import { colors, radii, sizes, spacing } from '@/theme/tokens';

type SavedTab = 'dishes' | 'versions';

const SEGMENTS = [
  { label: 'Dishes', value: 'dishes' },
  { label: 'Versions', value: 'versions' },
] as const;

const SAVED_DISH_IDS = ['beef', 'dumpling', 'katsu'];
const SAVED_VERSION_IDS = ['banhmi-saigon', 'beef-xian', 'dumpling-alley'];

export type SavedScreenProps = {
  onOpenDish: (dishId: string) => void;
  onOpenVersion: (versionId: string) => void;
  onBrowseDiscover: () => void;
};

export function SavedScreen({ onBrowseDiscover, onOpenDish, onOpenVersion }: SavedScreenProps) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<SavedTab>('dishes');
  const [unsavedIds, setUnsavedIds] = useState<string[]>([]);

  const rows = useMemo(() => {
    if (tab === 'dishes') {
      return SAVED_DISH_IDS.map((dishId) => {
        const dish = dishById(dishId);
        const dishVersions = versionsOfDish(dish.id);
        return {
          key: dishId,
          kind: 'DISH' as const,
          image: foodImages[dishVersions[0].id],
          title: dish.name,
          subtitle: `${dishVersions.length} ${dishVersions.length === 1 ? 'version near you' : 'versions near you'}`,
          onPress: () => onOpenDish(dish.id),
        };
      });
    }

    return SAVED_VERSION_IDS.map((savedId) => {
      const version = versionById(savedId);
      return {
        key: savedId,
        kind: 'VERSION' as const,
        image: foodImages[version.id],
        title: dishForVersion(version).name,
        subtitle: `${version.restaurant} · ${money(version.price)} · ${version.wouldEatAgain}%`,
        onPress: () => onOpenVersion(version.id),
      };
    });
  }, [onOpenDish, onOpenVersion, tab]);

  const visibleRows = rows.filter((row) => !unsavedIds.includes(row.key));
  const hint =
    tab === 'dishes'
      ? 'Dishes you want to keep exploring — every restaurant version stays in one place.'
      : 'One dish at one restaurant. The exact bowl you want to find again.';

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
      style={styles.screen}
    >
      <View style={[styles.header, { paddingTop: Math.max(58, insets.top + spacing[11]) }]}>
        <Text style={styles.title}>Saved</Text>
        <SegmentedControl onChange={setTab} options={SEGMENTS} style={styles.segments} value={tab} />
        <Text style={styles.hint}>{hint}</Text>
      </View>

      {visibleRows.length ? (
        <View style={styles.list}>
          {visibleRows.map((row) => (
            <SavedCard
              image={row.image}
              key={row.key}
              kind={row.kind}
              onPress={row.onPress}
              onRemove={() => setUnsavedIds((current) => [...current, row.key])}
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
