import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CompareIcon, MapIcon } from '@/components/icons';
import {
  ActionButton,
  DetailHeader,
  DetailScreen,
  DetailScroll,
  IconButton,
  PixelEyebrow,
  StickyFooter,
  VersionRow,
} from '@/components/details';
import { dishById, money, versionsOfDish } from '@/data/mockData';
import { colors, radii, sizes, type } from '@/theme/tokens';

export type DishBlockScreenProps = {
  dishId?: string;
  onBack?: () => void;
  onOpenVersion?: (versionId: string) => void;
  onOpenMap?: (dishId: string) => void;
  onOpenCompare?: (dishId: string, versionIds: string[]) => void;
};

export function DishBlockScreen({
  dishId = 'beef',
  onBack,
  onOpenVersion,
  onOpenMap,
  onOpenCompare,
}: DishBlockScreenProps) {
  const dish = dishById(dishId);
  const versions = useMemo(() => versionsOfDish(dish.id), [dish.id]);
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const minimumPrice = Math.min(...versions.map((version) => version.price));

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

  return (
    <DetailScreen>
      <DetailHeader
        title={dish.name}
        onBack={onBack}
        translucent
        right={(
          <IconButton onPress={() => onOpenMap?.(dish.id)} accessibilityLabel="Open dish map">
            <MapIcon size={18} color={colors.purpleDark} strokeWidth={1.7} />
          </IconButton>
        )}
      />

      <DetailScroll bottomInset={compareMode ? 118 : 146}>
        <View style={styles.intro}>
          <PixelEyebrow purple style={styles.blockEyebrow}>DISH BLOCK</PixelEyebrow>
          <Text style={styles.title}>{dish.name}</Text>
          <Text style={styles.subline}>
            {versions.length} {versions.length === 1 ? 'version' : 'versions'} near you · from {money(minimumPrice)}
          </Text>
          <View style={styles.tools}>
            <Pressable
              onPress={toggleCompare}
              style={({ pressed }) => [styles.tool, compareMode && styles.toolActive, pressed && styles.pressed]}
            >
              <CompareIcon size={16} color={compareMode ? colors.purpleDark : colors.body} strokeWidth={1.8} />
              <Text style={[styles.toolText, compareMode && styles.toolTextActive]}>{compareMode ? 'Cancel' : 'Compare'}</Text>
            </Pressable>
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
