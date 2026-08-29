import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type ScrollViewProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Image, type ImageProps } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackIcon, CloseIcon } from '@/components/icons';
import { colors, radii, shadows, sizes, type } from '@/theme/tokens';

type DetailScreenProps = {
  children: ReactNode;
  safeTop?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function DetailScreen({ children, safeTop = true, style }: DetailScreenProps) {
  if (!safeTop) {
    return <View style={[styles.screen, style]}>{children}</View>;
  }
  return (
    <SafeAreaView edges={['top']} style={[styles.screen, style]}>
      {children}
    </SafeAreaView>
  );
}

type DetailScrollProps = ScrollViewProps & {
  bottomInset?: number;
};

export function DetailScroll({ bottomInset = 60, contentContainerStyle, ...props }: DetailScrollProps) {
  return (
    <ScrollView
      {...props}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[contentContainerStyle, { paddingBottom: bottomInset }]}
    />
  );
}

type HeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  close?: boolean;
  right?: ReactNode;
  translucent?: boolean;
};

export function DetailHeader({ title, subtitle, onBack, close = false, right, translucent = false }: HeaderProps) {
  const Icon = close ? CloseIcon : BackIcon;
  return (
    <View style={[styles.header, translucent && styles.headerTranslucent]}>
      {translucent ? <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} /> : null}
      <IconButton onPress={onBack} accessibilityLabel={close ? 'Close' : 'Back'}>
        <Icon size={close ? 13 : 15} color={colors.ink} strokeWidth={1.9} />
      </IconButton>
      <View style={styles.headerCopy}>
        <Text numberOfLines={1} style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ?? null}
    </View>
  );
}

type IconButtonProps = PressableProps & {
  children: ReactNode;
  floating?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({ children, floating = false, style, disabled, ...props }: IconButtonProps) {
  return (
    <Pressable
      {...props}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconButton,
        floating && styles.floatingIconButton,
        style,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

type StickyFooterProps = {
  children: ReactNode;
  transparent?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function StickyFooter({ children, transparent = false, style }: StickyFooterProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.stickyFooter,
        transparent && styles.transparentFooter,
        { paddingBottom: Math.max(insets.bottom, 24) },
        style,
      ]}
    >
      {!transparent ? <BlurView intensity={92} tint="light" style={StyleSheet.absoluteFill} /> : null}
      {children}
    </View>
  );
}

type ActionButtonProps = PressableProps & {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function ActionButton({
  children,
  variant = 'primary',
  icon,
  style,
  textStyle,
  disabled,
  ...props
}: ActionButtonProps) {
  const primary = variant === 'primary';
  return (
    <Pressable
      {...props}
      disabled={disabled}
      style={({ pressed }) => [
        styles.action,
        primary ? styles.actionPrimary : styles.actionSecondary,
        disabled && styles.actionDisabled,
        style,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {icon}
      <Text
        style={[
          styles.actionText,
          primary ? styles.actionTextPrimary : styles.actionTextSecondary,
          disabled && styles.actionTextDisabled,
          textStyle,
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

export function PixelEyebrow({ children, purple = false, style }: { children: ReactNode; purple?: boolean; style?: StyleProp<TextStyle> }) {
  return <Text style={[type.pixelEyebrow, { color: purple ? colors.purple : colors.muted }, style]}>{children}</Text>;
}

export function ProgressBar({ value, width = sizes.progressWidth }: { value: number; width?: number }) {
  return (
    <View style={[styles.progressTrack, { width }]}>
      <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, value))}%` }]} />
    </View>
  );
}

export function Tag({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <View style={[styles.tag, compact && styles.tagCompact]}>
      <Text style={[styles.tagText, compact && styles.tagTextCompact]}>{children}</Text>
    </View>
  );
}

export function FoodImage(props: ImageProps) {
  return <Image {...props} contentFit="cover" transition={0} />;
}

export function HeroFade({ height = 96 }: { height?: number }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={['rgba(255,255,255,0.92)', 'rgba(255,255,255,0)']}
      style={[styles.heroFade, { height }]}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    minHeight: 46,
    paddingHorizontal: sizes.navGutter,
    paddingBottom: 11,
    paddingTop: 1,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 20,
  },
  headerTranslucent: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 14,
    marginTop: 1,
  },
  iconButton: {
    width: sizes.backButton,
    height: sizes.backButton,
    borderRadius: radii.compact + 1,
    backgroundColor: colors.controlSurface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  floatingIconButton: {
    width: sizes.floatingButton,
    height: sizes.floatingButton,
    borderRadius: radii.control,
    backgroundColor: 'rgba(255,255,255,0.92)',
    ...shadows.floating,
  },
  stickyFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    flexDirection: 'row',
    gap: 11,
    paddingTop: 12,
    paddingHorizontal: sizes.pageGutter,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  transparentFooter: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
  },
  action: {
    minHeight: 49,
    borderRadius: radii.button,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionPrimary: {
    backgroundColor: colors.purple,
  },
  actionSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  actionDisabled: {
    backgroundColor: colors.disabledSurface,
    borderColor: colors.disabledSurface,
    shadowOpacity: 0,
    elevation: 0,
  },
  actionText: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '600',
  },
  actionTextPrimary: {
    color: colors.white,
  },
  actionTextSecondary: {
    color: colors.body,
  },
  actionTextDisabled: {
    color: colors.disabled,
  },
  pressed: {
    opacity: 0.72,
  },
  progressTrack: {
    height: sizes.progressHeight,
    borderRadius: 3,
    backgroundColor: colors.track,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.purple,
  },
  tag: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.chipSurface,
  },
  tagCompact: {
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  tagText: {
    color: colors.purpleDark,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '600',
  },
  tagTextCompact: {
    fontSize: 11.5,
    lineHeight: 14,
  },
  heroFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
});
