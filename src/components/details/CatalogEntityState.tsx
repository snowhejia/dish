import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, sizes, spacing, type } from '@/theme/tokens';

import { ActionButton, DetailHeader, DetailScreen } from './DetailPrimitives';

export type CatalogEntityStateProps = {
  entity: 'dish' | 'dish version' | 'restaurant';
  error?: string | null;
  loading?: boolean;
  onBack?: () => void;
  onRetry?: () => void;
};

export function CatalogEntityState({
  entity,
  error,
  loading = false,
  onBack,
  onRetry,
}: CatalogEntityStateProps) {
  return (
    <DetailScreen>
      <DetailHeader onBack={onBack} title={loading ? 'Loading…' : 'Not available'} />
      <View style={styles.centered}>
        {loading ? (
          <>
            <ActivityIndicator color={colors.purple} />
            <Text style={styles.body}>Loading this {entity}…</Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>This {entity} is not available</Text>
            <Text accessibilityRole={error ? 'alert' : undefined} style={styles.body}>
              {error ?? 'It may have been removed, or the link may no longer be valid.'}
            </Text>
            {error && onRetry ? (
              <ActionButton onPress={onRetry} style={styles.retry}>Try again</ActionButton>
            ) : null}
          </>
        )}
      </View>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: spacing[24],
    paddingHorizontal: sizes.pageGutter,
  },
  title: {
    ...type.sectionTitle,
    color: colors.ink,
    textAlign: 'center',
  },
  body: {
    ...type.body,
    color: colors.muted,
    marginTop: spacing[8],
    maxWidth: 330,
    textAlign: 'center',
  },
  retry: {
    marginTop: spacing[18],
    minWidth: 140,
  },
});
