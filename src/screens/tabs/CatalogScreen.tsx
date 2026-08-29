import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Dishy } from '@/components/brand';
import { ChevronDownIcon } from '@/components/icons';
import {
  BottomTabSpacer,
  CatalogRow,
  HorizontalChipList,
  PixelEyebrow,
  SearchField,
  SegmentedControl,
} from '@/components/tabs';
import { foodImages } from '@/data/images';
import { dishes, distance, money, restaurants, versions, versionsOfDish } from '@/data/mockData';
import { colors, radii, sizes, spacing } from '@/theme/tokens';

type CatalogTab = 'dishes' | 'restaurants';

const SEGMENTS = [
  { label: 'Dishes', value: 'dishes' },
  { label: 'Restaurants', value: 'restaurants' },
] as const;

export type CatalogScreenProps = {
  onOpenDish: (dishId: string) => void;
  onOpenVersion: (versionId: string) => void;
};

export function CatalogScreen({ onOpenDish, onOpenVersion }: CatalogScreenProps) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<CatalogTab>('dishes');
  const filters = tab === 'dishes' ? ['Cuisine', 'Dish type', 'Price', 'Distance'] : ['Cuisine', 'Open now', 'Distance'];

  const rows = useMemo(() => {
    if (tab === 'dishes') {
      return dishes.map((dish) => {
        const dishVersions = versionsOfDish(dish.id);
        const from = Math.min(...dishVersions.map((version) => version.price));
        return {
          key: dish.id,
          image: foodImages[dishVersions[0].id],
          title: dish.name,
          subtitle: `${dish.cuisine} · ${dishVersions.length} ${dishVersions.length === 1 ? 'version' : 'versions'} · from ${money(from)}`,
          onPress: () => onOpenDish(dish.id),
        };
      });
    }

    return restaurants.map((restaurant) => {
      const restaurantVersions = versions.filter((version) => version.restaurant === restaurant);
      const first = restaurantVersions[0];
      return {
        key: restaurant,
        image: foodImages[first.id],
        title: restaurant,
        subtitle: `${first.cuisine} · ${distance(first.metres)} · ${restaurantVersions.length} ${restaurantVersions.length === 1 ? 'dish rated' : 'dishes rated'}`,
        onPress: () => onOpenVersion(first.id),
      };
    });
  }, [onOpenDish, onOpenVersion, tab]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
      style={styles.screen}
    >
      <View style={[styles.header, { paddingTop: Math.max(58, insets.top + spacing[11]) }]}>
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text style={styles.title}>Catalog</Text>
            <Text style={styles.subtitle}>Every dish and restaurant on Dish.</Text>
          </View>
          <Dishy size={58} variant="discover" />
        </View>
        <SearchField placeholder="Search all dishes & restaurants" style={styles.search} />
        <SegmentedControl onChange={setTab} options={SEGMENTS} style={styles.segments} value={tab} />
      </View>

      <HorizontalChipList style={styles.filterContent}>
        {filters.map((label) => (
          <View key={label} style={styles.filterChip}>
            <Text style={styles.filterLabel}>{label}</Text>
            <ChevronDownIcon color={colors.muted} size={9} strokeWidth={1.6} />
          </View>
        ))}
      </HorizontalChipList>

      <PixelEyebrow style={styles.eyebrow}>
        {tab === 'dishes' ? `ALL DISHES · ${dishes.length}` : `ALL RESTAURANTS · ${restaurants.length}`}
      </PixelEyebrow>

      <View style={styles.list}>
        {rows.map((row) => (
          <CatalogRow
            image={row.image}
            key={row.key}
            onPress={row.onPress}
            subtitle={row.subtitle}
            title={row.title}
          />
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
  header: {
    paddingHorizontal: sizes.pageGutter,
  },
  titleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing[10],
    justifyContent: 'space-between',
  },
  titleCopy: {
    flex: 1,
  },
  title: {
    color: colors.ink,
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: -0.7,
    lineHeight: 32,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13.5,
    lineHeight: 17,
    marginTop: spacing[4],
  },
  search: {
    marginTop: spacing[14],
  },
  segments: {
    marginTop: spacing[14],
  },
  filterContent: {
    paddingBottom: spacing[2],
    paddingTop: spacing[14],
  },
  filterChip: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[5],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[7],
  },
  filterLabel: {
    color: colors.body,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 16,
  },
  eyebrow: {
    paddingBottom: spacing[8],
    paddingHorizontal: sizes.pageGutter,
    paddingTop: spacing[18],
  },
  list: {
    paddingBottom: spacing[26],
    paddingHorizontal: sizes.pageGutter,
  },
});
