import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackIcon, DirectionsIcon } from '@/components/icons';
import {
  ActionButton,
  CatalogEntityState,
  DetailScreen,
  FoodImage,
  HeroFade,
  IconButton,
  PixelEyebrow,
  VersionRow,
} from '@/components/details';
import { fallbackRestaurantImage } from '@/data/images';
import { versionAvailability, versionById, versionDistance, versions } from '@/data/mockData';
import { colors, sizes, type } from '@/theme/tokens';
import { useCatalog } from '@/providers/CatalogProvider';

export type RestaurantDetailScreenProps = {
  restaurantName?: string;
  versionId?: string;
  onBack?: () => void;
  onOpenVersion?: (versionId: string) => void;
  onGetDirections?: (versionId: string) => void;
  onCallPhone?: (phone: string) => void;
};

export function RestaurantDetailScreen({
  restaurantName,
  versionId,
  onBack,
  onOpenVersion,
  onGetDirections,
  onCallPhone,
}: RestaurantDetailScreenProps) {
  const { error, loading, refreshCatalog, revision } = useCatalog();
  const insets = useSafeAreaInsets();
  const sourceVersion = versionById(versionId);
  const resolvedName = restaurantName?.trim() || sourceVersion?.restaurant;
  const restaurantVersions = useMemo(
    () => resolvedName ? versions.filter((version) => version.restaurant === resolvedName) : [],
    [resolvedName, revision],
  );
  const heroVersion = restaurantVersions.find((version) => version.id === versionId) ?? restaurantVersions[0];
  const restaurantImageUrl = heroVersion?.restaurantImageUrl;
  const [restaurantImageFailed, setRestaurantImageFailed] = useState(false);

  useEffect(() => {
    setRestaurantImageFailed(false);
  }, [restaurantImageUrl]);

  if (!resolvedName || !heroVersion) {
    return (
      <CatalogEntityState
        entity="restaurant"
        error={error}
        loading={loading}
        onBack={onBack}
        onRetry={() => void refreshCatalog()}
      />
    );
  }

  return (
    <DetailScreen safeTop={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          {restaurantImageUrl && !restaurantImageFailed ? (
            <FoodImage
              source={{ uri: restaurantImageUrl }}
              style={StyleSheet.absoluteFill}
              accessibilityLabel={resolvedName}
              onError={() => setRestaurantImageFailed(true)}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.restaurantPlaceholder]}>
              <Image
                accessibilityLabel={`${resolvedName} has no restaurant photo yet`}
                contentFit="contain"
                source={fallbackRestaurantImage}
                style={styles.restaurantPlaceholderLogo}
              />
            </View>
          )}
          <HeroFade height={90} />
          <IconButton
            floating
            onPress={onBack}
            accessibilityLabel="Back"
            style={[styles.back, { top: insets.top + 6 }]}
          >
            <BackIcon size={15} color={colors.ink} strokeWidth={1.9} />
          </IconButton>
        </View>

        <View style={styles.summary}>
          <Text style={styles.title}>{resolvedName}</Text>
          <View style={styles.hoursRow}>
            <View style={styles.openChip}><Text style={styles.openText}>{versionAvailability(heroVersion)}</Text></View>
          </View>
          <Text style={styles.address}>
            {heroVersion.address ?? 'Address not provided'}{`\n`}
            <Text style={styles.meta}>
              {heroVersion.cuisine} · {versionDistance(heroVersion)}
            </Text>
          </Text>
          {heroVersion.hours ? <Text style={styles.contact}>{heroVersion.hours}</Text> : null}
          {heroVersion.phone ? (
            <Pressable onPress={() => onCallPhone?.(heroVersion.phone!)}>
              <Text style={[styles.contact, styles.contactLink]}>{heroVersion.phone}</Text>
            </Pressable>
          ) : null}
          <ActionButton
            icon={<DirectionsIcon size={17} color={colors.white} strokeWidth={1.8} />}
            style={styles.directions}
            onPress={() => onGetDirections?.(heroVersion.id)}
          >
            Get directions
          </ActionButton>
        </View>

        <View style={styles.goodSection}>
          <PixelEyebrow>WHAT IS GOOD HERE</PixelEyebrow>
          <Text style={styles.explainer}>
            Every score belongs to that dish at this restaurant — not to the restaurant overall.
          </Text>
          <View style={styles.list}>
            {restaurantVersions.map((version) => (
              <VersionRow
                key={version.id}
                version={version}
                compact
                showChevron
                onPress={() => onOpenVersion?.(version.id)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 60,
  },
  hero: {
    position: 'relative',
    width: '100%',
    height: 210,
    backgroundColor: colors.imageSurface,
  },
  restaurantPlaceholder: {
    alignItems: 'center',
    backgroundColor: colors.lavender,
    justifyContent: 'center',
  },
  restaurantPlaceholderLogo: {
    height: 128,
    width: 128,
  },
  back: {
    position: 'absolute',
    left: sizes.navGutter,
    zIndex: 5,
  },
  summary: {
    paddingHorizontal: sizes.pageGutter,
    paddingTop: 18,
  },
  title: {
    ...type.hero,
    color: colors.ink,
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 9,
  },
  openChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.successSurface,
  },
  openText: {
    color: colors.success,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
  },
  address: {
    color: colors.body,
    fontSize: 13.5,
    lineHeight: 20.25,
    marginTop: 12,
  },
  meta: {
    color: colors.muted,
  },
  contact: {
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 7,
  },
  contactLink: {
    color: colors.purpleLogo,
    fontWeight: '600',
  },
  directions: {
    marginTop: 15,
    minHeight: 47,
  },
  goodSection: {
    paddingHorizontal: sizes.pageGutter,
    paddingTop: 24,
  },
  explainer: {
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 7,
  },
  list: {
    gap: 11,
    marginTop: 14,
  },
});
