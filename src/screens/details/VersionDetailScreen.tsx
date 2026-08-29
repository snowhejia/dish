import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackIcon, ChevronRightIcon, DirectionsIcon, ReviewIcon } from '@/components/icons';
import {
  ActionButton,
  DetailScreen,
  FoodImage,
  HeroFade,
  IconButton,
  PixelEyebrow,
  StickyFooter,
  Tag,
} from '@/components/details';
import { foodImages } from '@/data/images';
import {
  defaultReviews,
  dishForVersion,
  money,
  reviewsByVersion,
  versionAvailability,
  versionById,
  versionDistance,
  versionMenuName,
  versions,
  versionsOfDish,
  type DishVersion,
} from '@/data/mockData';
import { colors, radii, shadows, sizes, type } from '@/theme/tokens';

export type VersionDetailScreenProps = {
  versionId?: string;
  onBack?: () => void;
  onOpenRestaurant?: (restaurantName: string) => void;
  onOpenReview?: (versionId: string) => void;
  onOpenVersion?: (versionId: string) => void;
  onSeeAllVersions?: (dishId: string) => void;
  onGetDirections?: (versionId: string) => void;
};

export function VersionDetailScreen({
  versionId = 'beef-xian',
  onBack,
  onOpenRestaurant,
  onOpenReview,
  onOpenVersion,
  onSeeAllVersions,
  onGetDirections,
}: VersionDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const version = versionById(versionId);
  const dish = dishForVersion(version);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const galleryCount = version.galleryCount ?? 4;
  const reviews = reviewsByVersion[version.id] ?? defaultReviews;
  const otherVersions = useMemo(
    () => versionsOfDish(version.dishId).filter((item) => item.id !== version.id),
    [version.dishId, version.id],
  );
  const sameRestaurant = useMemo(
    () => versions.filter((item) => item.restaurant === version.restaurant && item.id !== version.id),
    [version.id, version.restaurant],
  );

  return (
    <DetailScreen safeTop={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <FoodImage
            source={foodImages[version.id]}
            style={StyleSheet.absoluteFill}
            accessibilityLabel={`${versionMenuName(version)} at ${version.restaurant}`}
            contentPosition={galleryPositions[galleryIndex % galleryPositions.length]}
          />
          <HeroFade />
          <IconButton
            floating
            onPress={onBack}
            accessibilityLabel="Back"
            style={[styles.heroBack, { top: insets.top + 6 }]}
          >
            <BackIcon size={15} color={colors.ink} strokeWidth={1.9} />
          </IconButton>
          <View style={styles.galleryLabel}>
            <Text style={styles.galleryLabelText}>{galleryIndex + 1} / {galleryCount}</Text>
          </View>
          <View style={styles.galleryDots}>
            {Array.from({ length: galleryCount }, (_, index) => index).map((index) => (
              <Pressable
                key={index}
                hitSlop={7}
                onPress={() => setGalleryIndex(index)}
                style={[styles.galleryDot, index === galleryIndex ? styles.galleryDotActive : styles.galleryDotInactive]}
              />
            ))}
          </View>
        </View>

        <View style={styles.summary}>
          <Text style={styles.title}>{versionMenuName(version)}</Text>
          <Pressable
            onPress={() => onOpenRestaurant?.(version.restaurant)}
            style={({ pressed }) => [styles.restaurantLink, pressed && styles.pressed]}
          >
            <Text style={styles.restaurantText}>{version.restaurant}</Text>
            <ChevronRightIcon size={13} color={colors.purpleLogo} strokeWidth={1.9} />
          </Pressable>
          <Text style={styles.meta}>{version.cuisine} · {versionDistance(version)} · {versionAvailability(version)}</Text>

          <View style={styles.scoreCard}>
            <View>
              <Text style={styles.price}>{money(version.price)}</Text>
              <Text style={styles.priceCaption}>typical price paid</Text>
            </View>
            <View style={styles.scoreDivider} />
            <View style={styles.scoreCopy}>
              <Text style={styles.score}>{version.wouldEatAgain}% would eat it again</Text>
              <Text style={styles.scoreCaption}>{version.votes} {version.votes === 1 ? 'vote' : 'votes'} from diners</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <PixelEyebrow>WHAT PEOPLE SAY</PixelEyebrow>
          <View style={styles.tags}>
            {version.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
          </View>
        </View>

        <View style={styles.reviewsSection}>
          <PixelEyebrow>RECENT REVIEWS</PixelEyebrow>
          <View style={styles.reviewList}>
            {reviews.map((review, index) => (
              <View key={`${review.name}-${index}`} style={styles.reviewCard}>
                <View style={styles.reviewTop}>
                  <Text style={styles.reviewName}>{review.name}</Text>
                  <View style={[styles.verdict, review.yes ? styles.verdictYes : styles.verdictNo]}>
                    <Text style={[styles.verdictText, review.yes ? styles.verdictYesText : styles.verdictNoText]}>
                      {review.yes ? "I'd eat it again" : 'Not again'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.reviewText}>{review.text}</Text>
              </View>
            ))}
          </View>
        </View>

        <RelatedStrip
          eyebrow="OTHER VERSIONS"
          items={otherVersions}
          onOpenVersion={onOpenVersion}
          onSeeAll={otherVersions.length ? () => onSeeAllVersions?.(dish.id) : undefined}
        />

        <RelatedStrip
          eyebrow={`ALSO GOOD AT ${version.restaurant.toUpperCase()}`}
          items={sameRestaurant}
          showDishName
          onOpenVersion={onOpenVersion}
        />
      </ScrollView>

      <StickyFooter>
        <ActionButton
          variant="secondary"
          style={styles.reviewButton}
          icon={<ReviewIcon size={17} color={colors.body} strokeWidth={1.8} />}
          onPress={() => onOpenReview?.(version.id)}
        >
          Review
        </ActionButton>
        <ActionButton
          style={styles.directionButton}
          icon={<DirectionsIcon size={17} color={colors.white} strokeWidth={1.8} />}
          onPress={() => onGetDirections?.(version.id)}
        >
          Get directions
        </ActionButton>
      </StickyFooter>
    </DetailScreen>
  );
}

function RelatedStrip({
  eyebrow,
  items,
  showDishName = false,
  onOpenVersion,
  onSeeAll,
}: {
  eyebrow: string;
  items: DishVersion[];
  showDishName?: boolean;
  onOpenVersion?: (versionId: string) => void;
  onSeeAll?: () => void;
}) {
  if (!items.length && !onSeeAll) return null;
  return (
    <View style={styles.relatedSection}>
      <View style={styles.relatedHeading}>
        <PixelEyebrow style={styles.relatedEyebrow}>{eyebrow}</PixelEyebrow>
        {onSeeAll ? (
          <Pressable onPress={onSeeAll} hitSlop={8}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.relatedList}
      >
        {items.map((item) => {
          return (
            <Pressable
              key={item.id}
              onPress={() => onOpenVersion?.(item.id)}
              style={({ pressed }) => [styles.relatedCard, pressed && styles.pressed]}
            >
              <View style={styles.relatedImage}>
                <FoodImage source={foodImages[item.id]} style={StyleSheet.absoluteFill} accessibilityLabel={versionMenuName(item)} />
              </View>
              <Text numberOfLines={2} style={styles.relatedName}>{showDishName ? versionMenuName(item) : item.restaurant}</Text>
              <Text style={styles.relatedMeta}>{money(item.price)} · {item.wouldEatAgain}%</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const galleryPositions = ['center', 'top', 'bottom', 'left'] as const;

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 132,
  },
  hero: {
    position: 'relative',
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.imageSurface,
  },
  heroBack: {
    position: 'absolute',
    left: sizes.navGutter,
    zIndex: 5,
  },
  galleryLabel: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(20,16,42,0.70)',
  },
  galleryLabelText: {
    color: colors.white,
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: '600',
  },
  galleryDots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  galleryDot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
  },
  galleryDotActive: {
    backgroundColor: colors.white,
  },
  galleryDotInactive: {
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  summary: {
    paddingHorizontal: sizes.pageGutter,
    paddingTop: 18,
  },
  title: {
    ...type.hero,
    color: colors.ink,
  },
  restaurantLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 7,
    alignSelf: 'flex-start',
  },
  restaurantText: {
    color: colors.purpleLogo,
    fontSize: 15.5,
    lineHeight: 19,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 17,
    marginTop: 5,
  },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 15,
    borderRadius: radii.card,
    backgroundColor: colors.softSurface,
  },
  price: {
    color: colors.ink,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  priceCaption: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 14,
    marginTop: 2,
  },
  scoreDivider: {
    width: 1,
    height: 38,
    backgroundColor: '#E6E4F0',
  },
  scoreCopy: {
    flex: 1,
  },
  score: {
    color: colors.purpleDark,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  scoreCaption: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 14,
    marginTop: 3,
  },
  section: {
    paddingHorizontal: sizes.pageGutter,
    paddingTop: 22,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 11,
  },
  reviewsSection: {
    paddingHorizontal: sizes.pageGutter,
    paddingTop: 24,
  },
  reviewList: {
    gap: 12,
    marginTop: 12,
  },
  reviewCard: {
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 15,
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewName: {
    color: colors.ink,
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: '600',
  },
  verdict: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: radii.pill,
  },
  verdictYes: { backgroundColor: '#EFECFC' },
  verdictNo: { backgroundColor: '#F3F2F7' },
  verdictText: { fontSize: 11.5, lineHeight: 14, fontWeight: '600' },
  verdictYesText: { color: colors.purpleDark },
  verdictNoText: { color: '#6E6B84' },
  reviewText: {
    ...type.body,
    color: colors.body,
    marginTop: 8,
  },
  relatedSection: {
    paddingTop: 24,
  },
  relatedHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sizes.pageGutter,
  },
  relatedEyebrow: {
    flex: 1,
    marginRight: 10,
  },
  seeAll: {
    color: colors.purple,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  relatedList: {
    gap: 12,
    paddingHorizontal: sizes.pageGutter,
    paddingTop: 12,
    paddingBottom: 4,
  },
  relatedCard: {
    width: sizes.relatedWidth,
  },
  relatedImage: {
    width: sizes.relatedWidth,
    height: sizes.relatedHeight,
    borderRadius: radii.button,
    overflow: 'hidden',
    backgroundColor: colors.imageSurface,
  },
  relatedName: {
    color: colors.ink,
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginTop: 8,
  },
  relatedMeta: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 14,
    marginTop: 3,
  },
  reviewButton: { flex: 1 },
  directionButton: { flex: 1.25, ...shadows.primary },
  pressed: { opacity: 0.72 },
});
