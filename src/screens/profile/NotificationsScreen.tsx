import {
  ProfileCollectionScreen,
  displayDate,
  firstString,
  type ProfileCollectionScreenProps,
  type ProfileResourceItem,
} from './ProfileCollectionScreen';

type Props = Pick<ProfileCollectionScreenProps, 'onBack' | 'onSignIn'>;

export function NotificationsScreen(props: Props) {
  return (
    <ProfileCollectionScreen
      {...props}
      collectionKey="notifications"
      emptyBody="Contribution updates and account notices will appear here."
      emptyTitle="You are all caught up"
      endpoint="/api/v1/me/notifications"
      present={presentNotification}
      title="Notifications"
    />
  );
}

function presentNotification(item: ProfileResourceItem) {
  const read = item.read === true || item.readAt != null || item.read_at != null;
  return {
    title: firstString(item, 'title', 'subject') ?? 'Dish. update',
    meta: displayDate(item.createdAt ?? item.created_at),
    body: firstString(item, 'body', 'message', 'text'),
    badge: read ? undefined : 'New',
    badgeTone: 'positive' as const,
  };
}
