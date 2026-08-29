import {
  ProfileCollectionScreen,
  displayDate,
  firstString,
  type ProfileCollectionScreenProps,
  type ProfileResourceItem,
} from './ProfileCollectionScreen';

type Props = Pick<ProfileCollectionScreenProps, 'onBack' | 'onSignIn'>;

export function MyContributionsScreen(props: Props) {
  return (
    <ProfileCollectionScreen
      {...props}
      collectionKey="contributions"
      emptyBody="Dish versions you submit will appear here with their review status."
      emptyTitle="No contributions yet"
      endpoint="/api/v1/me/contributions"
      present={presentContribution}
      title="My contributions"
    />
  );
}

function presentContribution(item: ProfileResourceItem) {
  const status = firstString(item, 'status') ?? 'Pending';
  const normalized = status.toLowerCase();
  const restaurant = firstString(item, 'restaurantName', 'restaurant_name', 'restaurant');
  const date = displayDate(item.createdAt ?? item.created_at);
  return {
    title: firstString(item, 'dishName', 'dish_name', 'versionName', 'version_name') ?? 'Dish version',
    meta: [restaurant, date].filter(Boolean).join(' · ') || undefined,
    body: firstString(item, 'rejectionReason', 'rejection_reason', 'note', 'moderationNote', 'moderation_note'),
    badge: status,
    badgeTone: normalized === 'approved' ? 'positive' as const : normalized === 'pending' ? 'pending' as const : 'neutral' as const,
  };
}
