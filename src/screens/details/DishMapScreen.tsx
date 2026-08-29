import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type DimensionValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Dishy } from '@/components/brand';
import { BackIcon, ChevronRightIcon } from '@/components/icons';
import { DetailScreen, FoodImage, IconButton } from '@/components/details';
import { foodImages } from '@/data/images';
import {
  dishById,
  money,
  versionAvailability,
  versionDistance,
  versionMenuName,
  versionsOfDish,
} from '@/data/mockData';
import { colors, radii, shadows, sizes } from '@/theme/tokens';

export type DishMapScreenProps = {
  dishId?: string;
  initialVersionId?: string;
  onBack?: () => void;
  onSelectVersion?: (versionId: string) => void;
  onOpenVersion?: (versionId: string) => void;
};

export function DishMapScreen({
  dishId = 'beef',
  initialVersionId,
  onBack,
  onSelectVersion,
  onOpenVersion,
}: DishMapScreenProps) {
  const insets = useSafeAreaInsets();
  const dish = dishById(dishId);
  const dishVersions = useMemo(() => versionsOfDish(dish.id), [dish.id]);
  const fallbackId = dishVersions[0]?.id ?? 'beef-xian';
  const startId = dishVersions.some((version) => version.id === initialVersionId) ? initialVersionId! : fallbackId;
  const [selectedId, setSelectedId] = useState(startId);
  const selected = dishVersions.find((version) => version.id === selectedId) ?? dishVersions[0];
  const minimumPrice = Math.min(...dishVersions.map((version) => version.price));

  const selectVersion = (versionId: string) => {
    setSelectedId(versionId);
    onSelectVersion?.(versionId);
  };

  if (!selected) return null;

  return (
    <DetailScreen safeTop={false} style={styles.screen}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.roadHorizontal, styles.roadTop]} />
        <View style={[styles.roadHorizontal, styles.roadBottom]} />
        <View style={[styles.roadVertical, styles.roadLeft]} />
        <View style={[styles.roadVertical, styles.roadRight]} />
        <View style={styles.park} />
        <Text style={styles.parkLabel}>Victoria Park</Text>
        <View style={styles.campus} />
        <Text style={styles.campusLabel}>USYD</Text>
      </View>

      <View style={[styles.mapHeader, { top: insets.top + 6 }]}>
        <IconButton floating onPress={onBack} accessibilityLabel="Back">
          <BackIcon size={15} color={colors.ink} strokeWidth={1.9} />
        </IconButton>
        <View style={styles.titleCard}>
          <View style={styles.titleCopy}>
            <Text numberOfLines={1} style={styles.title}>{dish.name}</Text>
            <Text numberOfLines={1} style={styles.subtitle}>
              {dishVersions.length} {dishVersions.length === 1 ? 'version' : 'versions'} near you · from {money(minimumPrice)}
            </Text>
          </View>
          <Dishy variant="map" size={46} />
        </View>
      </View>

      {dishVersions.map((version) => {
        const active = version.id === selected.id;
        return (
          <Pressable
            key={version.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${version.restaurant}, ${money(version.price)}`}
            onPress={() => selectVersion(version.id)}
            style={({ pressed }) => [
              styles.pin,
              { left: (version.mapX ?? '50%') as DimensionValue, top: version.mapY ?? 360 },
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.pinBubble, active && styles.pinBubbleActive]}>
              <Text style={[styles.pinText, active && styles.pinTextActive]}>{money(version.price)}</Text>
            </View>
            <View style={[styles.pinPoint, active && styles.pinPointActive]} />
          </Pressable>
        );
      })}

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
            source={foodImages[selected.id]}
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
  roadHorizontal: {
    position: 'absolute',
    left: -40,
    width: 520,
    backgroundColor: colors.white,
  },
  roadTop: {
    top: 120,
    height: 34,
    transform: [{ rotate: '-8deg' }],
  },
  roadBottom: {
    top: 430,
    height: 26,
    transform: [{ rotate: '5deg' }],
  },
  roadVertical: {
    position: 'absolute',
    top: -40,
    height: 900,
    backgroundColor: colors.white,
  },
  roadLeft: {
    left: 120,
    width: 30,
    transform: [{ rotate: '6deg' }],
  },
  roadRight: {
    left: 300,
    width: 22,
    transform: [{ rotate: '-4deg' }],
  },
  park: {
    position: 'absolute',
    left: 150,
    top: 352,
    width: 170,
    height: 140,
    borderRadius: radii.button,
    backgroundColor: colors.mapPark,
  },
  parkLabel: {
    position: 'absolute',
    left: 168,
    top: 364,
    color: '#7C9578',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  campus: {
    position: 'absolute',
    left: 20,
    top: 520,
    width: 120,
    height: 110,
    borderRadius: radii.control,
    backgroundColor: colors.mapCampus,
  },
  campusLabel: {
    position: 'absolute',
    left: 32,
    top: 532,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
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
  pin: {
    position: 'absolute',
    zIndex: 15,
    alignItems: 'center',
    transform: [{ translateX: -27 }, { translateY: -38 }],
  },
  pinBubble: {
    minWidth: 54,
    minHeight: 30,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    ...shadows.floating,
  },
  pinBubbleActive: {
    backgroundColor: colors.purple,
  },
  pinText: {
    color: colors.ink,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  pinTextActive: {
    color: colors.white,
  },
  pinPoint: {
    width: 8,
    height: 8,
    marginTop: -3,
    borderRadius: 1,
    backgroundColor: colors.surface,
    transform: [{ rotate: '45deg' }],
  },
  pinPointActive: {
    backgroundColor: colors.purple,
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
