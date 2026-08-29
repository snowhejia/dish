import {
  ProfileCollectionScreen,
  displayDate,
  firstString,
  type ProfileCollectionScreenProps,
  type ProfileResourceItem,
} from './ProfileCollectionScreen';

type Props = Pick<ProfileCollectionScreenProps, 'onBack' | 'onSignIn'> & {
  onOpenVersion: (versionId: string) => void;
};

export function MyPhotosScreen({ onOpenVersion, ...props }: Props) {
  return (
    <ProfileCollectionScreen
      {...props}
      collectionKey="photos"
      emptyBody="Photos you add to reviews and dish versions will appear here."
      emptyTitle="No photos yet"
      endpoint="/api/v1/me/photos"
      present={(item) => presentPhoto(item, onOpenVersion)}
      title="My photos"
    />
  );
}

function presentPhoto(item: ProfileResourceItem, onOpenVersion: (versionId: string) => void) {
  const versionId = firstString(item, 'versionId', 'version_id');
  const restaurant = firstString(item, 'restaurantName', 'restaurant_name');
  const date = displayDate(item.createdAt ?? item.created_at);
  const purpose = firstString(item, 'purpose');
  return {
    title: firstString(item, 'dishName', 'dish_name') ?? 'Dish photo',
    meta: [restaurant, date].filter(Boolean).join(' · ') || undefined,
    imageUrl: firstString(item, 'photoUrl', 'photo_url', 'imageUrl', 'image_url'),
    badge: purpose === 'review' ? 'Review' : purpose === 'contribution' ? 'Version' : undefined,
    onPress: versionId ? () => onOpenVersion(versionId) : undefined,
  };
}
