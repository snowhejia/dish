import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChevronRightIcon } from '@/components/icons';
import { colors, radii, sizes, spacing } from '@/theme/tokens';

export function CatalogRow({
  image,
  fallbackImage,
  title,
  subtitle,
  onPress,
}: {
  image: ImageSourcePropType;
  fallbackImage?: ImageSourcePropType;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const [resolvedImage, setResolvedImage] = useState(image);

  useEffect(() => {
    setResolvedImage(image);
  }, [image]);

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.root}>
      <View style={styles.imageFrame}>
        <Image
          contentFit="cover"
          onError={() => {
            if (fallbackImage && resolvedImage !== fallbackImage) setResolvedImage(fallbackImage);
          }}
          source={resolvedImage}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        <Text numberOfLines={1} style={styles.subtitle}>
          {subtitle}
        </Text>
      </View>
      <ChevronRightIcon color={colors.iconMuted} size={13} strokeWidth={1.8} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing[13],
    paddingVertical: spacing[11],
  },
  imageFrame: {
    backgroundColor: colors.imageSurface,
    borderRadius: radii.control,
    height: sizes.catalogThumb,
    overflow: 'hidden',
    width: sizes.catalogThumb,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 19,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 16,
    marginTop: spacing[3],
  },
});
