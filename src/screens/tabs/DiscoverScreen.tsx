import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Dishy } from '@/components/brand';
import { LocationPinIcon, ShuffleIcon } from '@/components/icons';
import {
  BottomTabSpacer,
  DiscoverVersionCard,
  HorizontalChipList,
  PixelEyebrow,
  SearchField,
} from '@/components/tabs';
import type { Dish, DishVersion } from '@/data/mockData';
import {
  normalizeCatalogText,
  searchableDishText,
  versionMatchesDiscoverFilter,
  type DiscoverFilter,
} from '@/lib/catalogFilters';
import { useCatalog } from '@/providers/CatalogProvider';
import { colors, radii, sizes, spacing } from '@/theme/tokens';

const QUICK_FILTERS = ['Soupy', 'Spicy', 'Under $20', '5 min walk', 'Open now'] as const satisfies readonly DiscoverFilter[];

type FeedItem = {
  dish: Dish;
  version: DishVersion;
  moreCount: number;
};

export type DiscoverScreenProps = {
  onOpenDish: (dishId: string) => void;
  showMascot?: boolean;
};

export function DiscoverScreen({ onOpenDish, showMascot = true }: DiscoverScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { snapshot, loading, error } = useCatalog();
  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<DiscoverFilter | null>(null);
  const [shuffleRevision, setShuffleRevision] = useState(0);

  const feed = useMemo(() => {
    const query = normalizeCatalogText(search);
    const items = snapshot.dishes.flatMap((dish): FeedItem[] => {
      const dishVersions = snapshot.versions.filter((version) => version.dishId === dish.id);
      const matchingVersions = dishVersions.filter((version) => {
        if (selectedFilter && !versionMatchesDiscoverFilter(dish, version, selectedFilter)) return false;
        return !query || searchableDishText(dish, [version]).includes(query);
      });
      const version = matchingVersions[0];
      return version
        ? [{ dish, version, moreCount: Math.max(0, dishVersions.length - 1) }]
        : [];
    });
    return interleaveByCuisine(items, shuffleRevision);
  }, [search, selectedFilter, shuffleRevision, snapshot]);

  const cardWidth = (width - sizes.pageGutter * 2 - spacing[12]) / 2;
  const hasSearch = Boolean(search.trim());
  const feedEyebrow = hasSearch
    ? `SEARCH RESULTS · ${feed.length}`
    : selectedFilter
      ? `${selectedFilter.toUpperCase()} · NEARBY`
      : 'NEARBY RIGHT NOW';

  const clearAll = () => {
    setSearch('');
    setSelectedFilter(null);
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.screen}
    >
      <View style={[styles.hero, { paddingTop: Math.max(56, insets.top + spacing[9]) }]}>
        <View style={styles.brandRow}>
          <Image
            accessibilityLabel="Dish app logo"
            accessible
            source={require('../../../assets/images/app-icon-dish.png')}
            style={styles.logo}
          />
          <View style={styles.locationPill}>
            <LocationPinIcon color={colors.purpleLogo} size={11} strokeWidth={1.5} />
            <Text style={styles.locationText}>USYD / Camperdown</Text>
          </View>
        </View>

        <View style={styles.heroCopyRow}>
          <Text style={styles.heroTitle}>What are you eating{`\n`}after class?</Text>
          {showMascot ? (
            <View style={styles.heroMascot}>
              <Dishy size={124} variant="enjoy" />
            </View>
          ) : null}
        </View>

        <SearchField
          onChangeText={setSearch}
          placeholder="Search dishes or restaurants..."
          surface="white"
          value={search}
        />
      </View>

      <HorizontalChipList style={styles.filterContent}>
        {QUICK_FILTERS.map((label) => {
          const active = label === selectedFilter;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={label}
              onPress={() => setSelectedFilter(active ? null : label)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </HorizontalChipList>

      <View style={styles.sectionHeader}>
        <PixelEyebrow>{feedEyebrow}</PixelEyebrow>
        {hasSearch ? (
          <Pressable accessibilityRole="button" onPress={() => setSearch('')} style={styles.shuffle}>
            <Text style={styles.shuffleLabel}>Clear</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Shuffle nearby dishes"
            onPress={() => setShuffleRevision((value) => value + 1)}
            style={styles.shuffle}
          >
            <ShuffleIcon color={colors.purple} size={14} strokeWidth={1.7} />
            <Text style={styles.shuffleLabel}>Shuffle</Text>
          </Pressable>
        )}
      </View>

      {loading ? <Text style={styles.status}>Refreshing nearby dishes…</Text> : null}
      {!loading && error ? <Text style={styles.status}>Showing the saved catalog while live data reconnects.</Text> : null}

      {feed.length ? <View style={styles.feedGrid}>
        {feed.map(({ dish, version, moreCount }) => (
          <DiscoverVersionCard
            dish={dish}
            key={dish.id}
            moreCount={moreCount}
            onPress={() => onOpenDish(dish.id)}
            version={version}
            width={cardWidth}
          />
        ))}
      </View> : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            {hasSearch ? `No dishes or restaurants match “${search.trim()}”` : 'No dishes match this filter yet'}
          </Text>
          <Pressable accessibilityRole="button" onPress={clearAll} style={styles.clearButton}>
            <Text style={styles.clearLabel}>Show everything</Text>
          </Pressable>
        </View>
      )}
      <BottomTabSpacer />
    </ScrollView>
  );
}

function interleaveByCuisine(items: FeedItem[], shuffleRevision: number) {
  const groups = new Map<string, FeedItem[]>();
  items.forEach((item) => {
    const group = groups.get(item.dish.cuisine) ?? [];
    group.push(item);
    groups.set(item.dish.cuisine, group);
  });

  const random = seededRandom(shuffleRevision);
  const queues = Array.from(groups.values());
  if (shuffleRevision > 0) {
    queues.forEach((queue) => shuffleInPlace(queue, random));
    shuffleInPlace(queues, random);
  }
  const result: FeedItem[] = [];
  let row = 0;
  while (result.length < items.length) {
    queues.forEach((queue) => {
      const item = queue[row];
      if (item) result.push(item);
    });
    row += 1;
  }
  return result;
}

function seededRandom(seed: number) {
  let value = seed || 1;
  return () => {
    value |= 0;
    value = value + 0x6D2B79F5 | 0;
    let result = Math.imul(value ^ value >>> 15, 1 | value);
    result = result + Math.imul(result ^ result >>> 7, 61 | result) ^ result;
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<Item>(items: Item[], random: () => number) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [items[index], items[target]] = [items[target]!, items[index]!];
  }
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  hero: {
    backgroundColor: colors.lavender,
    borderBottomLeftRadius: radii.hero,
    borderBottomRightRadius: radii.hero,
    paddingBottom: spacing[16],
    paddingHorizontal: sizes.pageGutter,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[16],
  },
  logo: {
    borderRadius: 9,
    height: 40,
    width: 40,
  },
  locationPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing[5],
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[5],
  },
  locationText: {
    color: colors.purpleLogo,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  heroCopyRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing[12],
    justifyContent: 'space-between',
    marginBottom: spacing[16],
  },
  heroTitle: {
    color: colors.titleInk,
    flex: 1,
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 29,
  },
  heroMascot: {
    alignItems: 'flex-end',
    flexShrink: 0,
    justifyContent: 'flex-end',
    marginBottom: -2,
    marginRight: -4,
    width: 122,
  },
  filterContent: {
    paddingBottom: spacing[4],
    paddingTop: spacing[14],
  },
  filterChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[8],
  },
  filterChipActive: {
    backgroundColor: colors.purple,
    borderColor: colors.purple,
  },
  filterLabel: {
    color: colors.body,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
  },
  filterLabelActive: {
    color: colors.white,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing[10],
    paddingHorizontal: sizes.pageGutter,
    paddingTop: spacing[16],
  },
  shuffle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[6],
  },
  shuffleLabel: {
    color: colors.purple,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
  },
  feedGrid: {
    columnGap: spacing[12],
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: spacing[26],
    paddingHorizontal: sizes.pageGutter,
    rowGap: spacing[14],
  },
  status: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 16,
    paddingBottom: spacing[10],
    paddingHorizontal: sizes.pageGutter,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: sizes.pageGutter,
    paddingTop: spacing[26],
  },
  emptyTitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
  },
  clearButton: {
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginTop: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
  },
  clearLabel: {
    color: colors.purple,
    fontSize: 12.5,
    fontWeight: '600',
  },
});
