import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackIcon, DirectionsIcon } from '@/components/icons';
import {
  ActionButton,
  DetailScreen,
  FoodImage,
  HeroFade,
  IconButton,
  PixelEyebrow,
  VersionRow,
} from '@/components/details';
import { foodImages } from '@/data/images';
import { versionAvailability, versionById, versionDistance, versions } from '@/data/mockData';
import { colors, sizes, type } from '@/theme/tokens';

export type RestaurantDetailScreenProps = {
  restaurantName?: string;
  versionId?: string;
  onBack?: () => void;
  onOpenVersion?: (versionId: string) => void;
  onGetDirections?: (restaurantName: string) => void;
};

export function RestaurantDetailScreen({
  restaurantName,
  versionId = 'beef-xian',
  onBack,
  onOpenVersion,
  onGetDirections,
}: RestaurantDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const sourceVersion = versionById(versionId);
  const resolvedName = restaurantName ?? sourceVersion.restaurant;
  const restaurantVersions = useMemo(
    () => versions.filter((version) => version.restaurant === resolvedName),
    [resolvedName],
  );
  const heroVersion = restaurantVersions.find((version) => version.id === versionId) ?? restaurantVersions[0] ?? sourceVersion;

  return (
    <DetailScreen safeTop={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <FoodImage
            source={foodImages[heroVersion.id]}
            style={StyleSheet.absoluteFill}
            accessibilityLabel={resolvedName}
          />
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
            <Text style={styles.until}>{heroVersion.source === 'real' ? 'Current venue schedule' : 'until 9:30 pm'}</Text>
          </View>
          <Text style={styles.address}>
            {heroVersion.address ?? '142 King Street, Newtown NSW 2042'}{`\n`}
            <Text style={styles.meta}>
              {heroVersion.cuisine} · {versionDistance(heroVersion)}{heroVersion.source === 'real' ? '' : ' from campus'}
            </Text>
          </Text>
          {heroVersion.hours ? <Text style={styles.contact}>{heroVersion.hours}</Text> : null}
          {heroVersion.phone ? <Text style={styles.contact}>{heroVersion.phone}</Text> : null}
          <ActionButton
            icon={<DirectionsIcon size={17} color={colors.white} strokeWidth={1.8} />}
            style={styles.directions}
            onPress={() => onGetDirections?.(resolvedName)}
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
  until: {
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 16,
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
