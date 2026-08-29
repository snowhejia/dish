import { useMemo, useState } from 'react';
import { useIsFocused } from 'expo-router';
import {
  Keyboard,
  Modal,
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
type FilterPickerKind = 'cuisine' | 'dishKind' | 'distance';

type FilterPickerOption = {
  label: string;
  value: string | null;
};

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
  const [filterPicker, setFilterPicker] = useState<FilterPickerKind | null>(null);

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

  const picker = useMemo(() => {
    if (filterPicker === 'cuisine') {
      return {
        title: 'Cuisine',
        selected: cuisine,
        options: [
          { label: 'All cuisines', value: null },
          ...cuisineOptions.map((value) => ({ label: value, value })),
        ] satisfies FilterPickerOption[],
      };
    }
    if (filterPicker === 'dishKind') {
      return {
        title: 'Dish type',
        selected: dishKind,
        options: [
          { label: 'All dish types', value: null },
          ...DISH_KIND_OPTIONS.map((value) => ({ label: value, value })),
        ] satisfies FilterPickerOption[],
      };
    }
    if (filterPicker === 'distance') {
      return {
        title: 'Distance',
        selected: distance === null ? null : String(distance),
        options: [
          { label: 'Any distance', value: null },
          ...DISTANCE_OPTIONS.map((value) => ({
            label: `Within ${formatDistance(value)}`,
            value: String(value),
          })),
        ] satisfies FilterPickerOption[],
      };
    }
    return null;
  }, [cuisine, cuisineOptions, dishKind, distance, filterPicker]);

  const selectFilterOption = (value: string | null) => {
    if (filterPicker === 'cuisine') setCuisine(value);
    if (filterPicker === 'dishKind') setDishKind(value as DishKindFilter | null);
    if (filterPicker === 'distance') {
      setDistance(value === null ? null : Number(value) as DistanceFilter);
    }
    setFilterPicker(null);
  };

  const openFilterPicker = (pickerKind: FilterPickerKind) => {
    Keyboard.dismiss();
    setFilterPicker(pickerKind);
  };

  const clearFilters = () => {
    setSearch('');
    setCuisine(null);
    setDishKind(null);
    setDistance(null);
    setOpenNow(false);
    setFilterPicker(null);
  };

  return (
    <>
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

        {tab === 'dishes' ? (
          <View style={styles.dishFilterRow}>
            <FilterChip
              active={Boolean(cuisine)}
              fill
              label={cuisine ?? 'Cuisine'}
              onPress={() => openFilterPicker('cuisine')}
            />
            <FilterChip
              active={Boolean(dishKind)}
              fill
              label={dishKind ?? 'Dish type'}
              onPress={() => openFilterPicker('dishKind')}
            />
          </View>
        ) : (
          <HorizontalChipList style={styles.filterContent}>
            <FilterChip
              active={Boolean(cuisine)}
              label={cuisine ?? 'Cuisine'}
              onPress={() => openFilterPicker('cuisine')}
            />
            <FilterChip
              active={openNow}
              label="Open now"
              onPress={() => setOpenNow((value) => !value)}
              selectable={false}
            />
            <FilterChip
              active={Boolean(distance)}
              label={distance ? `Within ${formatDistance(distance)}` : 'Distance'}
              onPress={() => openFilterPicker('distance')}
            />
          </HorizontalChipList>
        )}

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

      <FilterPickerModal
        bottomInset={insets.bottom}
        onClose={() => setFilterPicker(null)}
        onSelect={selectFilterOption}
        options={picker?.options ?? []}
        selected={picker?.selected ?? null}
        title={picker?.title ?? ''}
        visible={Boolean(picker)}
      />
    </>
  );
}

function FilterChip({
  active,
  fill = false,
  label,
  onPress,
  selectable = true,
}: {
  active: boolean;
  fill?: boolean;
  label: string;
  onPress: () => void;
  selectable?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.filterChip, fill && styles.filterChipFill, active && styles.filterChipActive]}
    >
      <Text numberOfLines={1} style={[styles.filterLabel, active && styles.filterLabelActive]}>{label}</Text>
      {selectable ? <ChevronDownIcon color={active ? colors.purple : colors.muted} size={9} strokeWidth={1.6} /> : null}
    </Pressable>
  );
}

function FilterPickerModal({
  bottomInset,
  onClose,
  onSelect,
  options,
  selected,
  title,
  visible,
}: {
  bottomInset: number;
  onClose: () => void;
  onSelect: (value: string | null) => void;
  options: FilterPickerOption[];
  selected: string | null;
  title: string;
  visible: boolean;
}) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.pickerOverlay}>
        <Pressable accessible={false} onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[styles.pickerSheet, { paddingBottom: Math.max(bottomInset, spacing[14]) }]}>
          <View style={styles.pickerHandle} />
          <Text style={styles.pickerTitle}>{title}</Text>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            {options.map((option) => {
              const isSelected = option.value === selected;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={option.value ?? 'all'}
                  onPress={() => onSelect(option.value)}
                  style={({ pressed }) => [styles.pickerOption, pressed && styles.pickerOptionPressed]}
                >
                  <Text style={[styles.pickerOptionLabel, isSelected && styles.pickerOptionLabelSelected]}>
                    {option.label}
                  </Text>
                  <View style={[styles.pickerRadio, isSelected && styles.pickerRadioSelected]}>
                    {isSelected ? <View style={styles.pickerRadioDot} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
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
  dishFilterRow: {
    flexDirection: 'row',
    gap: spacing[8],
    paddingBottom: spacing[2],
    paddingHorizontal: sizes.pageGutter,
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
  filterChipFill: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: '100%',
  },
  filterLabel: {
    color: colors.body,
    flexShrink: 1,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 16,
  },
  filterLabelActive: {
    color: colors.purpleDark,
  },
  pickerOverlay: {
    backgroundColor: 'rgba(20, 16, 42, 0.36)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.large,
    borderTopRightRadius: radii.large,
    maxHeight: '72%',
    paddingHorizontal: sizes.pageGutter,
    paddingTop: spacing[8],
  },
  pickerHandle: {
    alignSelf: 'center',
    backgroundColor: colors.borderStrong,
    borderRadius: radii.pill,
    height: 4,
    marginBottom: spacing[12],
    width: 38,
  },
  pickerTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.35,
    lineHeight: 23,
    paddingBottom: spacing[8],
  },
  pickerOption: {
    alignItems: 'center',
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 50,
    paddingVertical: spacing[8],
  },
  pickerOptionPressed: {
    opacity: 0.62,
  },
  pickerOptionLabel: {
    color: colors.body,
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
    paddingRight: spacing[12],
  },
  pickerOptionLabelSelected: {
    color: colors.purpleDark,
    fontWeight: '700',
  },
  pickerRadio: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  pickerRadioSelected: {
    borderColor: colors.purple,
  },
  pickerRadioDot: {
    backgroundColor: colors.purple,
    borderRadius: radii.pill,
    height: 10,
    width: 10,
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
