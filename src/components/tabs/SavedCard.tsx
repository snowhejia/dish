import { Image } from 'expo-image';
import type { ImageSourcePropType } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BookmarkIcon } from '@/components/icons';
import { colors, radii, sizes, spacing } from '@/theme/tokens';

export function SavedCard({
  kind,
  image,
  title,
  subtitle,
  onPress,
  onRemove,
}: {
  kind: 'DISH' | 'VERSION';
  image: ImageSourcePropType;
  title: string;
  subtitle: string;
  onPress: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.root}>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.mainAction}>
        <View style={styles.imageFrame}>
          <Image contentFit="cover" source={image} style={StyleSheet.absoluteFill} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.kind}>{kind}</Text>
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityLabel={`Remove saved ${kind.toLowerCase()}`}
        accessibilityRole="button"
        hitSlop={6}
        onPress={onRemove}
        style={styles.remove}
      >
        <BookmarkIcon color={colors.purple} filled size={14} strokeWidth={1.8} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[13],
    padding: spacing[11],
  },
  mainAction: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing[13],
    minWidth: 0,
  },
  imageFrame: {
    backgroundColor: colors.imageSurface,
    borderRadius: radii.control,
    height: sizes.savedThumb,
    overflow: 'hidden',
    width: sizes.savedThumb,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  kind: {
    color: colors.purple,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    lineHeight: 13,
  },
  title: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 19,
    marginTop: spacing[5],
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 16,
    marginTop: spacing[3],
  },
  remove: {
    alignItems: 'center',
    backgroundColor: colors.controlSurface,
    borderRadius: radii.compact,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
});
