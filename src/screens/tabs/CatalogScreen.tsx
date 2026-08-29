import { useMemo, useState } from 'react';
import { useIsFocused } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
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
import { fallbackFoodImage, fallbackRestaurantImage, foodImages, restaurantImages } from '@/data/images';
import { money, versionDistance, type DishVersion } from '@/data/mockData';
import {
  hasKnownDistance,
  isVersionOpenNow,
  normalizeCatalogText,
  searchableDishText,
  searchableRestaurantText,
  versionMatchesKind,
  type DishKindFilter,
} from '@/lib/catalogFilters';
import { useCatalog } from '@/providers/CatalogProvider';
import { colors, radii, sizes, spacing } from '@/theme/tokens';

type CatalogTab = 'dishes' | 'restaurants';
type DistanceFilter = 500 | 1000 | 2000;

type CatalogRowModel = {
  key: string;
  image: ImageSourcePropType;
  fallbackImage?: ImageSourcePropType;
  title: string;
  subtitle: string;
  onPress: () => void;
};

const SEGMENTS = [
  { label: 'Dishes', value: 'dishes' },
  { label: 'Restaurants', value: 'restaurants' },
] as const;

const DISTANCE_OPTIONS = [500, 1000, 2000] as const;
const DISH_KIND_OPTIONS = ['Soupy', 'Spicy'] as const;

export type CatalogScreenProps = {
  onOpenDish: (dishId: string) => void;
  onOpenRestaurant: (restaurantName: string, versionId?: string) => void;
};

export function CatalogScreen({ onOpenDish, onOpenRestaurant }: CatalogScreenProps) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { snapshot, loading, error } = useCatalog();
  const [tab, setTab] = useState<CatalogTab>('dishes');
  const [search, setSearch] = useState('');
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [dishKind, setDishKind] = useState<DishKindFilter | null>(null);
  const [distance, setDistance] = useState<DistanceFilter | null>(null);
  const [openNow, setOpenNow] = useState(false);

  const cuisineOptions = useMemo(() => Array.from(new Set([
    ...snapshot.dishes.map((dish) => dish.cuisine),
    ...snapshot.versions.map((version) => version.cuisine),
  ].filter(Boolean))).sort(), [snapshot]);

  const rows = useMemo<CatalogRowModel[]>(() => {
    const query = normalizeCatalogText(search);

    if (tab === 'dishes') {
      return snapshot.dishes.flatMap((dish): CatalogRowModel[] => {
        const allVersions = snapshot.versions.filter((version) => version.dishId === dish.id);
        if (query && !searchableDishText(dish, allVersions).includes(query)) return [];

        const matchingVersions = allVersions.filter((version) => {
          if (cuisine && dish.cuisine !== cuisine && version.cuisine !== cuisine) return false;
          if (dishKind && !versionMatchesKind(dish, version, dishKind)) return false;
          return true;
        });
        const first = matchingVersions[0];
        if (!first) return [];

        const from = Math.min(...matchingVersions.map((version) => version.price));
        return [{
          key: dish.id,
          image: foodImages[first.id] ?? fallbackFoodImage,
          title: dish.name,
          subtitle: `${dish.cuisine} · ${matchingVersions.length} ${matchingVersions.length === 1 ? 'version' : 'versions'} · from ${money(from)}`,
          onPress: () => onOpenDish(dish.id),
        }];
      });
    }

    return groupRestaurants(snapshot.versions).flatMap((restaurant): CatalogRowModel[] => {
      if (query && !searchableRestaurantText(restaurant.name, restaurant.versions).includes(query)) return [];

      const matchingVersions = restaurant.versions.filter((version) => {
        if (cuisine && version.cuisine !== cuisine) return false;
        if (openNow && !isVersionOpenNow(version)) return false;
        if (distance && (!hasKnownDistance(version) || version.metres > distance)) return false;
        return true;
      });
      const first = matchingVersions[0];
      if (!first) return [];

      return [{
        key: restaurant.key,
        image: first.restaurantImageUrl
          ? { uri: first.restaurantImageUrl }
          : restaurantImages[restaurant.name] ?? fallbackRestaurantImage,
        fallbackImage: restaurantImages[restaurant.name] ?? fallbackRestaurantImage,
        title: restaurant.name,
        subtitle: `${first.cuisine} · ${versionDistance(first)} · ${matchingVersions.length} ${matchingVersions.length === 1 ? 'dish rated' : 'dishes rated'}`,
        onPress: () => onOpenRestaurant(restaurant.name, first.id),
      }];
    });
  }, [cuisine, dishKind, distance, onOpenDish, onOpenRestaurant, openNow, search, snapshot, tab]);

  const activeFilterCount = [
    Boolean(cuisine),
    tab === 'dishes' && Boolean(dishKind),
    tab === 'restaurants' && Boolean(distance),
    tab === 'restaurants' && openNow,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearch('');
    setCuisine(null);
    setDishKind(null);
    setDistance(null);
    setOpenNow(false);
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
      scrollsToTop={isFocused}
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
        <SearchField
          onChangeText={setSearch}
          placeholder="Search all dishes & restaurants"
          style={styles.search}
          value={search}
        />
        <SegmentedControl onChange={setTab} options={SEGMENTS} style={styles.segments} value={tab} />
      </View>

      <HorizontalChipList style={styles.filterContent}>
        <FilterChip
          active={Boolean(cuisine)}
          label={cuisine ?? 'Cuisine'}
          onPress={() => setCuisine(nextOption(cuisine, cuisineOptions))}
        />
        {tab === 'dishes' ? (
          <FilterChip
            active={Boolean(dishKind)}
            label={dishKind ?? 'Dish type'}
            onPress={() => setDishKind(nextOption(dishKind, DISH_KIND_OPTIONS))}
          />
        ) : (
          <>
            <FilterChip
              active={openNow}
              label="Open now"
              onPress={() => setOpenNow((value) => !value)}
            />
            <FilterChip
              active={Boolean(distance)}
              label={distance ? `Within ${formatDistance(distance)}` : 'Distance'}
              onPress={() => setDistance(nextOption(distance, DISTANCE_OPTIONS))}
            />
          </>
        )}
      </HorizontalChipList>

      <View style={styles.resultHeading}>
        <PixelEyebrow>
          {tab === 'dishes' ? `DISHES · ${rows.length}` : `RESTAURANTS · ${rows.length}`}
        </PixelEyebrow>
        {activeFilterCount || search.trim() ? (
          <Pressable accessibilityRole="button" onPress={clearFilters}>
            <Text style={styles.clearLabel}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? <Text style={styles.status}>Refreshing the catalog…</Text> : null}
      {!loading && error ? <Text style={styles.status}>Showing the saved catalog while live data reconnects.</Text> : null}

      {rows.length ? (
        <View style={styles.list}>
          {rows.map((row) => (
            <CatalogRow
              fallbackImage={row.fallbackImage}
              image={row.image}
              key={row.key}
              onPress={row.onPress}
              subtitle={row.subtitle}
              title={row.title}
            />
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing matches yet</Text>
          <Text style={styles.emptyBody}>Try a broader search or clear the active filters.</Text>
          <Pressable accessibilityRole="button" onPress={clearFilters} style={styles.emptyButton}>
            <Text style={styles.emptyButtonLabel}>Show everything</Text>
          </Pressable>
        </View>
      )}
      <BottomTabSpacer />
    </ScrollView>
  );
}

function FilterChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.filterChip, active && styles.filterChipActive]}
    >
      <Text numberOfLines={1} style={[styles.filterLabel, active && styles.filterLabelActive]}>{label}</Text>
      <ChevronDownIcon color={active ? colors.purple : colors.muted} size={9} strokeWidth={1.6} />
    </Pressable>
  );
}

function nextOption<Value>(current: Value | null, options: readonly Value[]): Value | null {
  if (!options.length) return null;
  if (current === null) return options[0] ?? null;
  const nextIndex = options.indexOf(current) + 1;
  return nextIndex >= options.length ? null : options[nextIndex] ?? null;
}

function formatDistance(metres: DistanceFilter) {
  return metres >= 1000 ? `${metres / 1000} km` : `${metres} m`;
}

function groupRestaurants(items: DishVersion[]) {
  const groups = new Map<string, { key: string; name: string; versions: DishVersion[] }>();
  items.forEach((version) => {
    const key = version.restaurantId ?? normalizeCatalogText(version.restaurant);
    const group = groups.get(key) ?? { key, name: version.restaurant, versions: [] };
    group.versions.push(version);
    groups.set(key, group);
  });
  return Array.from(groups.values());
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
    maxWidth: 170,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[7],
  },
  filterChipActive: {
    backgroundColor: colors.lavender,
    borderColor: colors.borderStrong,
  },
  filterLabel: {
    color: colors.body,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 16,
  },
  filterLabelActive: {
    color: colors.purpleDark,
  },
  resultHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing[8],
    paddingHorizontal: sizes.pageGutter,
    paddingTop: spacing[18],
  },
  clearLabel: {
    color: colors.purple,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 16,
  },
  status: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: sizes.pageGutter,
    paddingVertical: spacing[5],
  },
  list: {
    paddingBottom: spacing[26],
    paddingHorizontal: sizes.pageGutter,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: sizes.pageGutter,
    paddingTop: spacing[26],
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
  },
  emptyBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing[5],
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: colors.lavender,
    borderRadius: radii.pill,
    marginTop: spacing[14],
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[8],
  },
  emptyButtonLabel: {
    color: colors.purpleDark,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 16,
  },
});
