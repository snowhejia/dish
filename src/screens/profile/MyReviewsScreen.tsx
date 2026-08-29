import {
  ProfileCollectionScreen,
  displayDate,
  firstString,
  type ProfileResourceItem,
  type ProfileCollectionScreenProps,
} from './ProfileCollectionScreen';

type Props = Pick<ProfileCollectionScreenProps, 'onBack' | 'onSignIn'>;

export function MyReviewsScreen(props: Props) {
  return (
    <ProfileCollectionScreen
      {...props}
      collectionKey="reviews"
      emptyBody="When you review a dish version, it will appear here."
      emptyTitle="No reviews yet"
      endpoint="/api/v1/me/reviews"
      present={presentReview}
      title="My reviews"
    />
  );
}

function presentReview(item: ProfileResourceItem) {
  const verdict = firstString(item, 'verdict', 'wouldEatAgain', 'would_eat_again');
  const hasBooleanVerdict = typeof item.yes === 'boolean' || typeof item.wouldEatAgain === 'boolean';
  const positive = item.yes === true || verdict === 'YES' || verdict === 'true' || item.wouldEatAgain === true;
  const restaurant = firstString(item, 'restaurantName', 'restaurant_name', 'restaurant');
  const date = displayDate(item.createdAt ?? item.created_at);
  return {
    title: firstString(item, 'dishName', 'dish_name', 'versionName', 'version_name') ?? 'Dish review',
    meta: [restaurant, date].filter(Boolean).join(' · ') || undefined,
    body: firstString(item, 'text', 'body', 'reviewText', 'review_text'),
    badge: verdict || hasBooleanVerdict ? (positive ? 'Eat again' : 'Not again') : undefined,
    badgeTone: positive ? 'positive' as const : 'neutral' as const,
  };
}
