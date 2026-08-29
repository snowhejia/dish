import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Dish, DishVersion } from '@/data/mockData';
import { money, versionDistance } from '@/data/mockData';
import { fallbackFoodImage, foodImages } from '@/data/images';
import { colors, radii, spacing } from '@/theme/tokens';

export function DiscoverVersionCard({
  dish,
  version,
  moreCount,
  width,
  onPress,
}: {
  dish: Dish;
  version: DishVersion;
  moreCount: number;
  width: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${dish.name} at ${version.restaurant}`}
      accessibilityRole="button"
      onPress={onPress}
      style={{ width }}
    >
      <View style={styles.imageFrame}>
        <Image contentFit="cover" source={foodImages[version.id] ?? fallbackFoodImage} style={StyleSheet.absoluteFill} />
        {moreCount > 0 ? (
          <BlurView intensity={18} tint="dark" style={styles.moreBadge}>
            <Text style={styles.moreLabel}>+{moreCount} MORE</Text>
          </BlurView>
        ) : null}
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={2} style={styles.title}>
          {dish.name}
        </Text>
        <Text numberOfLines={1} style={styles.restaurant}>
          {version.restaurant}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          {version.cuisine} · {versionDistance(version)} · {money(version.price)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  imageFrame: {
    aspectRatio: 4 / 3,
    backgroundColor: colors.imageSurface,
    borderRadius: radii.card,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  moreBadge: {
    backgroundColor: 'rgba(20,16,42,0.72)',
    borderRadius: radii.badge,
    overflow: 'hidden',
    paddingHorizontal: spacing[7],
    paddingVertical: spacing[5],
    position: 'absolute',
    right: spacing[8],
    top: spacing[8],
  },
  moreLabel: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.45,
    lineHeight: 11,
  },
  copy: {
    paddingHorizontal: spacing[2],
    paddingTop: spacing[9],
  },
  title: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.25,
    lineHeight: 18.3,
  },
  restaurant: {
    color: colors.bodySoft,
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: 15,
    marginTop: spacing[3],
  },
  meta: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 14,
    marginTop: spacing[3],
  },
});
