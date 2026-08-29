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

export function MyVersionsAddedScreen({ onOpenVersion, ...props }: Props) {
  return (
    <ProfileCollectionScreen
      {...props}
      collectionKey="versions"
      emptyBody="Approved dish versions you contribute will appear here."
      emptyTitle="No published versions yet"
      endpoint="/api/v1/me/versions-added"
      present={(item) => presentVersion(item, onOpenVersion)}
      title="Versions added"
    />
  );
}

function presentVersion(item: ProfileResourceItem, onOpenVersion: (versionId: string) => void) {
  const versionId = firstString(item, 'versionId', 'version_id');
  const dishName = firstString(item, 'dishName', 'dish_name') ?? 'Dish version';
  const menuName = firstString(item, 'menuName', 'menu_name');
  const restaurant = firstString(item, 'restaurantName', 'restaurant_name');
  const date = displayDate(item.createdAt ?? item.created_at);
  const price = moneyValue(item.price);
  return {
    title: dishName,
    meta: [restaurant, price, date].filter(Boolean).join(' · ') || undefined,
    body: menuName && menuName !== dishName ? menuName : undefined,
    imageUrl: firstString(item, 'photoUrl', 'photo_url', 'imageUrl', 'image_url'),
    badge: 'Published',
    badgeTone: 'positive' as const,
    onPress: versionId ? () => onOpenVersion(versionId) : undefined,
  };
}

function moneyValue(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined;
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : undefined;
}
