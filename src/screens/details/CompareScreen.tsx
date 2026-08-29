import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Dishy } from '@/components/brand';
import { DetailHeader, DetailScreen, FoodImage, Tag } from '@/components/details';
import { foodImages } from '@/data/images';
import {
  dishById,
  distance,
  money,
  versionsOfDish,
  type DishVersion,
} from '@/data/mockData';
import { colors, radii, sizes } from '@/theme/tokens';

export type CompareScreenProps = {
  dishId?: string;
  versionIds?: string[];
  onBack?: () => void;
  onOpenVersion?: (versionId: string) => void;
};

export function CompareScreen({
  dishId = 'beef',
  versionIds,
  onBack,
  onOpenVersion,
}: CompareScreenProps) {
  const dish = dishById(dishId);
  const columns = useMemo(() => {
    const available = versionsOfDish(dish.id);
    const requested = versionIds
      ?.map((id) => available.find((version) => version.id === id))
      .filter((version): version is DishVersion => Boolean(version))
      .filter((version, index, items) => items.findIndex((item) => item.id === version.id) === index);
    return (requested && requested.length >= 2 ? requested : available.slice(0, 2)).slice(0, 3);
  }, [dish.id, versionIds]);
  const bestScore = Math.max(...columns.map((version) => version.wouldEatAgain));

  return (
    <DetailScreen>
      <DetailHeader
        title="Compare versions"
        subtitle={dish.name}
        onBack={onBack}
        right={<Dishy variant="compare" size={50} />}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.columnRow}>
          <View style={styles.labelSpacer} />
          {columns.map((column) => (
            <View key={column.id} style={styles.column}>
              <View style={styles.photo}>
                <FoodImage
                  source={foodImages[column.id]}
                  style={StyleSheet.absoluteFill}
                  accessibilityLabel={`${dish.name} at ${column.restaurant}`}
                />
              </View>
              <Text numberOfLines={2} style={styles.restaurant}>{column.restaurant}</Text>
            </View>
          ))}
        </View>

        <View style={styles.metrics}>
          <MetricRow
            label="Would eat again"
            columns={columns}
            renderValue={(column) => `${column.wouldEatAgain}%`}
            colorFor={(column) => column.wouldEatAgain === bestScore ? colors.purpleDark : colors.ink}
          />
          <MetricRow label="Votes" columns={columns} renderValue={(column) => `${column.votes}`} />
          <MetricRow label="Price" columns={columns} renderValue={(column) => money(column.price)} />
          <MetricRow label="Distance" columns={columns} renderValue={(column) => distance(column.metres)} />
        </View>

        <View style={styles.peopleRow}>
          <Text style={[styles.rowLabel, styles.peopleLabel]}>What people say</Text>
          {columns.map((column) => (
            <View key={column.id} style={styles.tagColumn}>
              {column.tags.slice(0, 3).map((tag) => <Tag key={tag} compact>{tag}</Tag>)}
            </View>
          ))}
        </View>

        <View style={styles.actionRow}>
          <View style={styles.labelSpacer} />
          {columns.map((column) => (
            <Pressable
              key={column.id}
              onPress={() => onOpenVersion?.(column.id)}
              style={({ pressed }) => [styles.detailButton, pressed && styles.pressed]}
            >
              <Text style={styles.detailButtonText}>View details</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </DetailScreen>
  );
}

function MetricRow({
  label,
  columns,
  renderValue,
  colorFor,
}: {
  label: string;
  columns: DishVersion[];
  renderValue: (version: DishVersion) => string;
  colorFor?: (version: DishVersion) => string;
}) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      {columns.map((column) => (
        <Text key={column.id} numberOfLines={1} style={[styles.metricValue, { color: colorFor?.(column) ?? colors.ink }]}>
          {renderValue(column)}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 56,
  },
  columnRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 16,
  },
  labelSpacer: {
    width: sizes.compareLabel,
    flexShrink: 0,
  },
  column: {
    flex: 1,
    minWidth: 0,
  },
  photo: {
    width: '100%',
    aspectRatio: 1,
    overflow: 'hidden',
    borderRadius: radii.button,
    backgroundColor: colors.imageSurface,
  },
  restaurant: {
    color: colors.ink,
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginTop: 9,
  },
  metrics: {
    paddingHorizontal: 14,
    paddingTop: 18,
  },
  metricRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  rowLabel: {
    width: sizes.compareLabel,
    flexShrink: 0,
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 15,
  },
  metricValue: {
    flex: 1,
    minWidth: 0,
    fontSize: 14.5,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  peopleRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  peopleLabel: {
    paddingTop: 3,
  },
  tagColumn: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    gap: 6,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 20,
  },
  detailButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailButtonText: {
    color: colors.purpleDark,
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.72,
  },
});
