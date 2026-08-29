import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Dishy } from '@/components/brand';
import { ActionButton, DetailHeader, DetailScreen } from '@/components/details';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import { colors, radii, sizes, spacing, type } from '@/theme/tokens';

export type ProfileResourceItem = Record<string, unknown>;

export type ResourcePresentation = {
  title: string;
  meta?: string;
  body?: string;
  imageUrl?: string;
  badge?: string;
  badgeTone?: 'neutral' | 'positive' | 'pending';
  onPress?: () => void;
};

export type ProfileCollectionScreenProps = {
  title: string;
  endpoint: string;
  collectionKey: string;
  emptyTitle: string;
  emptyBody: string;
  onBack: () => void;
  onSignIn: () => void;
  present: (item: ProfileResourceItem) => ResourcePresentation;
  headerRight?: ReactNode;
};

export function ProfileCollectionScreen({
  collectionKey,
  emptyBody,
  emptyTitle,
  endpoint,
  headerRight,
  onBack,
  onSignIn,
  present,
  title,
}: ProfileCollectionScreenProps) {
  const { status } = useAuth();
  const [items, setItems] = useState<ProfileResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(async (refresh = false) => {
    if (status !== 'authenticated') return;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(undefined);
    try {
      const response = await api.get<unknown>(endpoint);
      setItems(extractCollection(response, collectionKey));
    } catch (loadError) {
      setError(apiErrorMessage(loadError, `Could not load ${title.toLowerCase()}.`));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [collectionKey, endpoint, status, title]);

  useEffect(() => {
    if (status === 'authenticated') void load();
    else setLoading(false);
  }, [load, status]);

  return (
    <DetailScreen>
      <DetailHeader onBack={onBack} right={headerRight} title={title} />
      {status === 'loading' || loading ? (
        <CenteredState>
          <ActivityIndicator color={colors.purple} size="small" />
          <Text style={styles.stateBody}>Loading…</Text>
        </CenteredState>
      ) : status === 'guest' ? (
        <CenteredState>
          <Dishy size={78} variant="neutral" />
          <Text style={styles.stateTitle}>Sign in to see {title.toLowerCase()}</Text>
          <Text style={styles.stateBody}>This page belongs to your personal Dish. account.</Text>
          <ActionButton onPress={onSignIn} style={styles.stateButton}>Sign in</ActionButton>
        </CenteredState>
      ) : error ? (
        <CenteredState>
          <Dishy size={78} variant="neutral" />
          <Text style={styles.stateTitle}>Could not load this page</Text>
          <Text accessibilityRole="alert" style={styles.stateBody}>{error}</Text>
          <ActionButton onPress={() => void load()} style={styles.stateButton}>Try again</ActionButton>
        </CenteredState>
      ) : !items.length ? (
        <CenteredState>
          <Dishy size={82} variant="saved" />
          <Text style={styles.stateTitle}>{emptyTitle}</Text>
          <Text style={styles.stateBody}>{emptyBody}</Text>
        </CenteredState>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={(
            <RefreshControl
              colors={[colors.purple]}
              onRefresh={() => void load(true)}
              refreshing={refreshing}
              tintColor={colors.purple}
            />
          )}
          showsVerticalScrollIndicator={false}
        >
          {items.map((item, index) => (
            <ResourceCard
              key={stringValue(item.id) ?? `${collectionKey}-${index}`}
              presentation={present(item)}
            />
          ))}
        </ScrollView>
      )}
    </DetailScreen>
  );
}

function ResourceCard({ presentation }: { presentation: ResourcePresentation }) {
  const tone = presentation.badgeTone ?? 'neutral';
  const details = (
    <>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle}>{presentation.title}</Text>
        {presentation.badge ? (
          <View style={[
            styles.badge,
            tone === 'positive' && styles.badgePositive,
            tone === 'pending' && styles.badgePending,
          ]}>
            <Text style={[
              styles.badgeText,
              tone === 'positive' && styles.badgeTextPositive,
              tone === 'pending' && styles.badgeTextPending,
            ]}>{presentation.badge}</Text>
          </View>
        ) : null}
      </View>
      {presentation.meta ? <Text style={styles.cardMeta}>{presentation.meta}</Text> : null}
      {presentation.body ? <Text style={styles.cardBody}>{presentation.body}</Text> : null}
    </>
  );
  const content = presentation.imageUrl ? (
    <View style={styles.cardWithImage}>
      <Image
        accessibilityLabel={`${presentation.title} photo`}
        contentFit="cover"
        source={{ uri: presentation.imageUrl }}
        style={styles.cardImage}
        transition={0}
      />
      <View style={styles.cardCopy}>{details}</View>
    </View>
  ) : details;

  if (!presentation.onPress) return <View style={styles.card}>{content}</View>;

  return (
    <Pressable
      accessibilityHint="Opens this dish version"
      accessibilityLabel={`Open ${presentation.title}`}
      accessibilityRole="button"
      onPress={presentation.onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {content}
    </Pressable>
  );
}

function CenteredState({ children }: { children: ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

function extractCollection(response: unknown, collectionKey: string): ProfileResourceItem[] {
  if (Array.isArray(response)) return recordsOnly(response);
  if (!response || typeof response !== 'object') return [];
  const root = response as Record<string, unknown>;
  const direct = root[collectionKey] ?? root.items;
  if (Array.isArray(direct)) return recordsOnly(direct);
  if (root.data && typeof root.data === 'object') {
    if (Array.isArray(root.data)) return recordsOnly(root.data);
    const data = root.data as Record<string, unknown>;
    const nested = data[collectionKey] ?? data.items;
    if (Array.isArray(nested)) return recordsOnly(nested);
  }
  return [];
}

function recordsOnly(values: unknown[]) {
  return values.filter((value): value is ProfileResourceItem => Boolean(value) && typeof value === 'object');
}

export function stringValue(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number') return String(value);
  return undefined;
}

export function firstString(item: ProfileResourceItem, ...keys: string[]) {
  for (const key of keys) {
    const value = stringValue(item[key]);
    if (value) return value;
  }
  return undefined;
}

export function displayDate(value: unknown) {
  const raw = stringValue(value);
  if (!raw) return undefined;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed);
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 48,
    paddingHorizontal: 34,
  },
  stateTitle: {
    ...type.sectionTitle,
    color: colors.ink,
    marginTop: spacing[16],
    textAlign: 'center',
  },
  stateBody: {
    ...type.body,
    color: colors.muted,
    marginTop: spacing[7],
    maxWidth: 330,
    textAlign: 'center',
  },
  stateButton: {
    marginTop: spacing[20],
    minWidth: 150,
  },
  list: {
    gap: spacing[11],
    paddingBottom: 48,
    paddingHorizontal: sizes.pageGutter,
    paddingTop: spacing[16],
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: radii.card,
    borderWidth: 1,
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[13],
  },
  cardPressed: {
    backgroundColor: colors.controlSurface,
    opacity: 0.82,
  },
  cardWithImage: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[12],
  },
  cardImage: {
    backgroundColor: colors.controlSurface,
    borderRadius: radii.control,
    height: 82,
    width: 92,
  },
  cardCopy: {
    flex: 1,
  },
  cardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[10],
  },
  cardTitle: {
    ...type.bodyStrong,
    color: colors.ink,
    flex: 1,
  },
  cardMeta: {
    ...type.caption,
    color: colors.muted,
    marginTop: spacing[4],
  },
  cardBody: {
    ...type.body,
    color: colors.body,
    marginTop: spacing[9],
  },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.controlSurface,
    borderRadius: radii.pill,
    height: 22,
    justifyContent: 'center',
    paddingHorizontal: spacing[9],
  },
  badgePositive: {
    backgroundColor: colors.successSurface,
  },
  badgePending: {
    backgroundColor: colors.pendingSurface,
  },
  badgeText: {
    color: colors.bodySoft,
    fontSize: 10.5,
    fontWeight: '700',
    includeFontPadding: false,
    lineHeight: 13,
    textAlignVertical: 'center',
    textTransform: 'uppercase',
  },
  badgeTextPositive: {
    color: colors.success,
  },
  badgeTextPending: {
    color: colors.pending,
  },
});
