import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
import { dishes, versionsOfDish, type Dish } from '@/data/mockData';
import { colors, fonts, radii, sizes, spacing } from '@/theme/tokens';

const QUICK_FILTERS = ['Soupy', 'Spicy', 'Under $20', '5 min walk', 'Open now'] as const;

export type DiscoverScreenProps = {
  onOpenCatalog: () => void;
  onOpenDish: (dishId: string) => void;
  showMascot?: boolean;
};

export function DiscoverScreen({ onOpenCatalog, onOpenDish, showMascot = true }: DiscoverScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [selectedFilter, setSelectedFilter] = useState<(typeof QUICK_FILTERS)[number] | null>(null);

  const feed = useMemo(
    () =>
      interleaveByCuisine(dishes).map((dish) => {
        const dishVersions = versionsOfDish(dish.id);
        return { dish, version: dishVersions[0], moreCount: Math.max(0, dishVersions.length - 1) };
      }),
    [],
  );

  const cardWidth = (width - sizes.pageGutter * 2 - spacing[12]) / 2;
  const feedEyebrow = selectedFilter ? `${selectedFilter.toUpperCase()} · NEARBY` : 'NEARBY RIGHT NOW';

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
      style={styles.screen}
    >
      <View style={[styles.hero, { paddingTop: Math.max(56, insets.top + spacing[9]) }]}>
        <View style={styles.brandRow}>
          <Text style={styles.logo}>DISH.</Text>
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
          onPress={onOpenCatalog}
          placeholder="Search dishes or restaurants..."
          surface="white"
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
        <Pressable accessibilityRole="button" onPress={() => setSelectedFilter(null)} style={styles.shuffle}>
          <ShuffleIcon color={colors.purple} size={14} strokeWidth={1.7} />
          <Text style={styles.shuffleLabel}>Shuffle</Text>
        </Pressable>
      </View>

      <View style={styles.feedGrid}>
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
      </View>
      <BottomTabSpacer />
    </ScrollView>
  );
}

function interleaveByCuisine(items: Dish[]) {
  const groups = new Map<string, Dish[]>();
  items.forEach((dish) => {
    const group = groups.get(dish.cuisine) ?? [];
    group.push(dish);
    groups.set(dish.cuisine, group);
  });

  const queues = Array.from(groups.values());
  const result: Dish[] = [];
  let row = 0;
  while (result.length < items.length) {
    queues.forEach((queue) => {
      const dish = queue[row];
      if (dish) result.push(dish);
    });
    row += 1;
  }
  return result;
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
    color: colors.purpleLogo,
    fontFamily: fonts.pixelBold,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
    lineHeight: 20,
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
});
