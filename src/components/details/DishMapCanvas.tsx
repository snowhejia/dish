import { Pressable, StyleSheet, Text, View, type DimensionValue } from 'react-native';

import { LocationPinIcon } from '@/components/icons';
import type { DishVersion } from '@/data/mockData';
import { colors, radii, shadows } from '@/theme/tokens';

export type DishMapCanvasProps = {
  versions: DishVersion[];
  selectedId: string;
  onSelect: (versionId: string) => void;
};

/** Lightweight web fallback; iOS and Android resolve DishMapCanvas.native.tsx. */
export function DishMapCanvas({ versions, selectedId, onSelect }: DishMapCanvasProps) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.roadHorizontal, styles.roadTop]} />
        <View style={[styles.roadHorizontal, styles.roadBottom]} />
        <View style={[styles.roadVertical, styles.roadLeft]} />
        <View style={[styles.roadVertical, styles.roadRight]} />
        <View style={styles.park} />
        <Text style={styles.parkLabel}>Victoria Park</Text>
        <View style={styles.campus} />
        <Text style={styles.campusLabel}>USYD</Text>
      </View>
      {versions.map((version, index) => {
        const active = version.id === selectedId;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={version.restaurant}
            key={version.id}
            onPress={() => onSelect(version.id)}
            style={({ pressed }) => [
              styles.marker,
              fallbackPosition(version, index),
              active && styles.markerActive,
              pressed && styles.pressed,
            ]}
          >
            <LocationPinIcon color={active ? colors.white : colors.purpleDark} filled={active} size={active ? 23 : 20} strokeWidth={1.8} />
          </Pressable>
        );
      })}
    </View>
  );
}

function fallbackPosition(version: DishVersion, index: number) {
  const positions = [
    { left: '24%', top: 205 },
    { left: '58%', top: 300 },
    { left: '76%', top: 450 },
    { left: '36%', top: 545 },
    { left: '68%', top: 610 },
  ];
  const fallback = positions[index % positions.length]!;
  return {
    left: (version.mapX ?? fallback.left) as DimensionValue,
    top: version.mapY ?? fallback.top,
  };
}

const styles = StyleSheet.create({
  roadHorizontal: { position: 'absolute', left: -40, width: 520, backgroundColor: colors.white },
  roadTop: { top: 120, height: 34, transform: [{ rotate: '-8deg' }] },
  roadBottom: { top: 430, height: 26, transform: [{ rotate: '5deg' }] },
  roadVertical: { position: 'absolute', top: -40, height: 900, backgroundColor: colors.white },
  roadLeft: { left: 120, width: 30, transform: [{ rotate: '6deg' }] },
  roadRight: { left: 300, width: 22, transform: [{ rotate: '-4deg' }] },
  park: { position: 'absolute', left: 150, top: 352, width: 170, height: 140, borderRadius: radii.button, backgroundColor: colors.mapPark },
  parkLabel: { position: 'absolute', left: 168, top: 364, color: '#7C9578', fontSize: 11, lineHeight: 14, fontWeight: '600' },
  campus: { position: 'absolute', left: 20, top: 520, width: 120, height: 110, borderRadius: radii.control, backgroundColor: colors.mapCampus },
  campusLabel: { position: 'absolute', left: 32, top: 532, color: colors.muted, fontSize: 11, lineHeight: 14, fontWeight: '600' },
  marker: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    transform: [{ translateX: -17 }, { translateY: -17 }],
    width: 34,
    ...shadows.floating,
  },
  markerActive: { backgroundColor: colors.purple, height: 40, width: 40 },
  pressed: { opacity: 0.72 },
});
