import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CheckIcon, ChevronRightIcon } from '@/components/icons';
import { foodImages } from '@/data/images';
import { dishForVersion, money, versionDistance, type DishVersion } from '@/data/mockData';
import { colors, radii, sizes } from '@/theme/tokens';

import { FoodImage, ProgressBar } from './DetailPrimitives';

type VersionRowProps = {
  version: DishVersion;
  onPress?: () => void;
  selectable?: boolean;
  selected?: boolean;
  compact?: boolean;
  showChevron?: boolean;
};

export function VersionRow({
  version,
  onPress,
  selectable = false,
  selected = false,
  compact = false,
  showChevron = false,
}: VersionRowProps) {
  const dish = dishForVersion(version);
  const imageSize = compact ? sizes.restaurantThumb : sizes.versionThumb;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && styles.pressed,
      ]}
    >
      {selectable ? (
        <View style={[styles.check, selected && styles.checkSelected]}>
          {selected ? <CheckIcon size={12} color={colors.white} strokeWidth={2.2} /> : null}
        </View>
      ) : null}
      <View style={[styles.imageFrame, { width: imageSize, height: imageSize }, compact && styles.imageCompact]}>
        <FoodImage source={foodImages[version.id]} style={StyleSheet.absoluteFill} accessibilityLabel={dish.name} />
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.restaurant}>{compact ? dish.name : version.restaurant}</Text>
        <Text numberOfLines={1} style={styles.meta}>
          {compact
            ? `${money(version.price)} · ${version.votes} ${version.votes === 1 ? 'vote' : 'votes'}`
            : `${versionDistance(version)} · ${version.votes} ${version.votes === 1 ? 'vote' : 'votes'}`}
        </Text>
        {compact ? null : <Text style={styles.price}>{money(version.price)}</Text>}
        <View style={styles.scoreRow}>
          <ProgressBar value={version.wouldEatAgain} />
          <Text numberOfLines={1} style={styles.score}>{version.wouldEatAgain}% would eat again</Text>
        </View>
      </View>
      {showChevron ? <ChevronRightIcon size={14} color={colors.iconMuted} strokeWidth={1.8} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 11,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  cardSelected: {
    borderColor: colors.purple,
  },
  pressed: {
    opacity: 0.76,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: radii.badge,
    borderWidth: 1.6,
    borderColor: '#D8D5E6',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkSelected: {
    borderColor: colors.purple,
    backgroundColor: colors.purple,
  },
  imageFrame: {
    flexShrink: 0,
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: colors.imageSurface,
  },
  imageCompact: {
    borderRadius: radii.control,
  },
  copy: {
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
  meta: {
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 16,
    marginTop: 3,
  },
  price: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginTop: 7,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  score: {
    flex: 1,
    color: colors.bodySoft,
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: '600',
  },
});
