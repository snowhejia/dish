import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { BookmarkIcon, CompareIcon, MapIcon } from '@/components/icons';
import {
  ActionButton,
  CatalogEntityState,
  DetailHeader,
  DetailScreen,
  DetailScroll,
  IconButton,
  PixelEyebrow,
  StickyFooter,
  VersionRow,
} from '@/components/details';
import { dishById, money, versionsOfDish } from '@/data/mockData';
import { useAuth } from '@/providers/AuthProvider';
import { useCatalog } from '@/providers/CatalogProvider';
import { colors, radii, sizes, type } from '@/theme/tokens';

export type DishBlockScreenProps = {
  dishId?: string;
  onBack?: () => void;
  onOpenVersion?: (versionId: string) => void;
  onOpenMap?: (dishId: string) => void;
  onOpenCompare?: (dishId: string, versionIds: string[]) => void;
  onSignIn?: () => void;
};

export function DishBlockScreen({
  dishId,
  onBack,
  onOpenVersion,
  onOpenMap,
  onOpenCompare,
  onSignIn,
}: DishBlockScreenProps) {
  const { isAuthenticated } = useAuth();
  const { error, loading, refreshCatalog, revision, isSaved, toggleSaved } = useCatalog();
  const dish = dishById(dishId);
  const versions = useMemo(() => versionsOfDish(dish?.id), [dish?.id, revision]);
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const compareAvailable = versions.length >= 2;
  const saved = dish ? isSaved('dish', dish.id) : false;

  const toggleDishSaved = async () => {
    if (!dish) return;
    if (!isAuthenticated) {
      onSignIn?.();
      return;
    }
    try {
      await toggleSaved('dish', dish.id);
    } catch (error) {
      Alert.alert('Could not update Saved', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const toggleCompare = () => {
    setCompareMode((current) => !current);
    setSelected([]);
  };

  const toggleVersion = (versionId: string) => {
    if (!compareMode) {
      onOpenVersion?.(versionId);
      return;
    }
    setSelected((current) => {
      if (current.includes(versionId)) return current.filter((id) => id !== versionId);
      if (current.length >= 3) return current;
      return [...current, versionId];
    });
  };

  const canCompare = selected.length >= 2;

  if (!dish) {
    return (
      <CatalogEntityState
        entity="dish"
        error={error}
        loading={loading}
        onBack={onBack}
        onRetry={() => void refreshCatalog()}
      />
    );
  }

  return (
    <DetailScreen>
      <DetailHeader
        title={dish.name}
        onBack={onBack}
        translucent
        right={<View style={styles.headerActions}>
          <IconButton onPress={() => void toggleDishSaved()} accessibilityLabel={saved ? 'Remove saved dish' : 'Save dish'}>
            <BookmarkIcon size={18} color={colors.purpleDark} strokeWidth={1.7} filled={saved} />
          </IconButton>
          <IconButton onPress={() => onOpenMap?.(dish.id)} accessibilityLabel="Open dish map">
            <MapIcon size={18} color={colors.purpleDark} strokeWidth={1.7} />
          </IconButton>
        </View>}
      />

      <DetailScroll bottomInset={compareMode ? 118 : 146}>
        <View style={styles.intro}>
          <PixelEyebrow purple style={styles.blockEyebrow}>DISH BLOCK</PixelEyebrow>
          <Text style={styles.title}>{dish.name}</Text>
          <Text style={styles.subline}>
            {versions.length} {versions.length === 1 ? 'version' : 'versions'} near you
          </Text>
          <View style={styles.tools}>
            {compareAvailable ? (
              <Pressable
                onPress={toggleCompare}
                style={({ pressed }) => [styles.tool, compareMode && styles.toolActive, pressed && styles.pressed]}
              >
                <CompareIcon size={16} color={compareMode ? colors.purpleDark : colors.body} strokeWidth={1.8} />
                <Text style={[styles.toolText, compareMode && styles.toolTextActive]}>{compareMode ? 'Cancel' : 'Compare'}</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => onOpenMap?.(dish.id)}
              style={({ pressed }) => [styles.tool, pressed && styles.pressed]}
            >
              <MapIcon size={16} color={colors.body} strokeWidth={1.8} />
              <Text style={styles.toolText}>Dish map</Text>
            </Pressable>
          </View>
        </View>

        <PixelEyebrow style={styles.listEyebrow}>
          {compareMode ? 'PICK 2 OR 3 TO COMPARE' : 'ALL VERSIONS'}
        </PixelEyebrow>
        <View style={styles.list}>
          {versions.map((version) => (
            <VersionRow
              key={version.id}
              version={version}
              selectable={compareMode}
              selected={selected.includes(version.id)}
              onPress={() => toggleVersion(version.id)}
            />
          ))}
        </View>
      </DetailScroll>

      {compareMode ? (
        <StickyFooter style={styles.compareFooter}>
          <Text style={styles.status}>{selected.length} of 3 selected</Text>
          <ActionButton
            disabled={!canCompare}
            style={styles.compareButton}
            onPress={() => onOpenCompare?.(dish.id, selected)}
          >
            Compare
          </ActionButton>
        </StickyFooter>
      ) : null}
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  intro: {
    paddingHorizontal: sizes.pageGutter,
    paddingTop: 18,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  blockEyebrow: {
    fontSize: 9,
  },
  title: {
    ...type.displayLarge,
    color: colors.ink,
    marginTop: 8,
  },
  subline: {
    ...type.body,
    color: colors.muted,
    marginTop: 6,
  },
  tools: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 15,
  },
  tool: {
    flex: 1,
    minHeight: 41,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.control,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  toolActive: {
    backgroundColor: colors.chipSurface,
    borderColor: '#CFC7F2',
  },
  toolText: {
    color: colors.body,
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: '600',
  },
  toolTextActive: {
    color: colors.purpleDark,
  },
  listEyebrow: {
    paddingHorizontal: sizes.pageGutter,
    paddingTop: 20,
    paddingBottom: 10,
  },
  list: {
    gap: 11,
    paddingHorizontal: sizes.pageGutter,
  },
  compareFooter: {
    alignItems: 'center',
    gap: 12,
    paddingBottom: 26,
  },
  status: {
    flex: 1,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 17,
  },
  compareButton: {
    minHeight: 45,
    paddingHorizontal: 22,
    borderRadius: 13,
  },
  pressed: {
    opacity: 0.72,
  },
});
