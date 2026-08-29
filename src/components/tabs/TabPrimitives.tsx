import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { SearchIcon } from '@/components/icons';
import { colors, radii, shadows, sizes, spacing, type } from '@/theme/tokens';

export function PixelEyebrow({
  children,
  color = colors.muted,
  style,
}: {
  children: ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.eyebrow, { color }, style]}>{children}</Text>;
}

export function SearchField({
  placeholder,
  onPress,
  surface = 'control',
  style,
}: {
  placeholder: string;
  onPress?: () => void;
  surface?: 'control' | 'white';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={[
        styles.search,
        surface === 'white' ? styles.searchWhite : styles.searchControl,
        surface === 'white' ? shadows.search : undefined,
        style,
      ]}
    >
      <SearchIcon color={colors.muted} size={16} strokeWidth={1.7} />
      <Text numberOfLines={1} style={styles.searchPlaceholder}>
        {placeholder}
      </Text>
    </Pressable>
  );
}

export type SegmentOption<Value extends string> = {
  label: string;
  value: Value;
};

export function SegmentedControl<Value extends string>({
  value,
  options,
  onChange,
  style,
}: {
  value: Value;
  options: readonly SegmentOption<Value>[];
  onChange: (value: Value) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.segmented, style]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text style={[styles.segmentLabel, !selected && styles.segmentLabelInactive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function HorizontalChipList({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView
      contentContainerStyle={[styles.chipContent, style]}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function BottomTabSpacer() {
  return <View style={styles.bottomSpacer} />;
}

const styles = StyleSheet.create({
  eyebrow: {
    ...type.pixelEyebrow,
  },
  search: {
    alignItems: 'center',
    borderRadius: radii.button,
    flexDirection: 'row',
    gap: spacing[9],
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
  },
  searchWhite: {
    backgroundColor: colors.surface,
  },
  searchControl: {
    backgroundColor: colors.controlSurface,
    borderRadius: 13,
  },
  searchPlaceholder: {
    color: colors.muted,
    flex: 1,
    fontSize: 14,
    lineHeight: 17,
  },
  segmented: {
    backgroundColor: colors.controlSurface,
    borderRadius: radii.control,
    flexDirection: 'row',
    padding: spacing[3],
  },
  segment: {
    alignItems: 'center',
    borderRadius: radii.segment,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing[9],
  },
  segmentSelected: {
    backgroundColor: colors.surface,
  },
  segmentLabel: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 17,
  },
  segmentLabelInactive: {
    color: colors.muted,
  },
  chipContent: {
    gap: spacing[8],
    paddingHorizontal: sizes.pageGutter,
  },
  bottomSpacer: {
    height: 96,
  },
});
