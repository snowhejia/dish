import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Dishy } from '@/components/brand';
import { BackIcon, ChevronRightIcon } from '@/components/icons';
import { CatalogEntityState, DetailScreen, DishMapCanvas, FoodImage, IconButton } from '@/components/details';
import { fallbackFoodImage, foodImages } from '@/data/images';
import {
  dishById,
  money,
  versionAvailability,
  versionDistance,
  versionMenuName,
  versionsOfDish,
} from '@/data/mockData';
import { colors, radii, shadows, sizes } from '@/theme/tokens';
import { useCatalog } from '@/providers/CatalogProvider';

export type DishMapScreenProps = {
  dishId?: string;
  initialVersionId?: string;
  onBack?: () => void;
  onSelectVersion?: (versionId: string) => void;
  onOpenVersion?: (versionId: string) => void;
};

export function DishMapScreen({
  dishId,
  initialVersionId,
  onBack,
  onSelectVersion,
  onOpenVersion,
}: DishMapScreenProps) {
  const { error, loading, refreshCatalog, revision } = useCatalog();
  const insets = useSafeAreaInsets();
  const dish = dishById(dishId);
  const dishVersions = useMemo(() => versionsOfDish(dish?.id), [dish?.id, revision]);
  const fallbackId = dishVersions[0]?.id ?? '';
  const startId = dishVersions.some((version) => version.id === initialVersionId) ? initialVersionId! : fallbackId;
  const [selectedId, setSelectedId] = useState(startId);
  const selected = dishVersions.find((version) => version.id === selectedId) ?? dishVersions[0];

  const selectVersion = (versionId: string) => {
    setSelectedId(versionId);
    onSelectVersion?.(versionId);
  };

  if (!dish || !selected) {
    return (
      <CatalogEntityState
        entity="dish"
        error={error}
        loading={loading}
        onBack={onBack}
        onRetry={() => void refreshCatalog()}
      />
    );
  }

  return (
    <DetailScreen safeTop={false} style={styles.screen}>
      <DishMapCanvas versions={dishVersions} selectedId={selected.id} onSelect={selectVersion} />

      <View style={[styles.mapHeader, { top: insets.top + 6 }]}>
        <IconButton floating onPress={onBack} accessibilityLabel="Back">
          <BackIcon size={15} color={colors.ink} strokeWidth={1.9} />
        </IconButton>
        <View style={styles.titleCard}>
          <View style={styles.titleCopy}>
            <Text numberOfLines={1} style={styles.title}>{dish.name}</Text>
            <Text numberOfLines={1} style={styles.subtitle}>
              {dishVersions.length} {dishVersions.length === 1 ? 'version' : 'versions'} near you
            </Text>
          </View>
          <Dishy variant="map" size={46} />
        </View>
      </View>

      <Pressable
        onPress={() => onOpenVersion?.(selected.id)}
        style={({ pressed }) => [
          styles.selectionCard,
          { bottom: Math.max(insets.bottom, 24) },
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.cardPhoto}>
          <FoodImage
            source={foodImages[selected.id] ?? fallbackFoodImage}
            style={StyleSheet.absoluteFill}
            accessibilityLabel={`${versionMenuName(selected)} at ${selected.restaurant}`}
          />
        </View>
        <View style={styles.cardCopy}>
          <Text numberOfLines={1} style={styles.restaurant}>{selected.restaurant}</Text>
          <Text style={styles.cardMeta}>{versionDistance(selected)} · {versionAvailability(selected)}</Text>
          <View style={styles.cardScoreRow}>
            <Text style={styles.cardPrice}>{money(selected.price)}</Text>
            <Text style={styles.cardScore}>{selected.wouldEatAgain}% would eat again</Text>
          </View>
        </View>
        <ChevronRightIcon size={13} color={colors.iconMuted} strokeWidth={1.8} />
      </Pressable>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    overflow: 'hidden',
    backgroundColor: colors.map,
  },
  mapHeader: {
    position: 'absolute',
    left: sizes.navGutter,
    right: sizes.navGutter,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titleCard: {
    minHeight: 54,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 13,
    borderRadius: radii.control,
    backgroundColor: colors.surface,
    ...shadows.floating,
  },
  titleCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.ink,
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 1,
  },
  selectionCard: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 25,
    minHeight: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radii.large,
    backgroundColor: colors.surface,
    ...shadows.mapCard,
  },
  cardPhoto: {
    width: sizes.mapThumb,
    height: sizes.mapThumb,
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: radii.button,
    backgroundColor: colors.imageSurface,
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  restaurant: {
    color: colors.ink,
    fontSize: 15.5,
    lineHeight: 19,
    fontWeight: '600',
    letterSpacing: -0.25,
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 16,
    marginTop: 3,
  },
  cardScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  cardPrice: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  cardScore: {
    color: colors.purpleDark,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.76,
  },
});
