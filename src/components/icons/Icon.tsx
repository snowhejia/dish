import Svg, {
  Circle,
  G,
  Line,
  Path,
  Polyline,
  Rect,
  type SvgProps,
} from 'react-native-svg';

import { colors } from '@/theme/tokens';

export type IconName =
  | 'search'
  | 'location-pin'
  | 'shuffle'
  | 'back'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'chevron-up'
  | 'map'
  | 'compare'
  | 'directions'
  | 'review'
  | 'plus'
  | 'close'
  | 'tab-discover'
  | 'tab-catalog'
  | 'tab-saved'
  | 'tab-profile'
  | 'check'
  | 'x'
  | 'camera'
  | 'pencil'
  | 'bookmark'
  | 'filter'
  | 'restaurant'
  | 'dish'
  | 'bell'
  | 'settings'
  | 'photos'
  | 'contributions'
  | 'heart';

export interface IconProps extends Omit<SvgProps, 'color' | 'height' | 'viewBox' | 'width'> {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  filled?: boolean;
}

export type IconComponentProps = Omit<IconProps, 'name'>;

interface GlyphProps {
  color: string;
  filled: boolean;
  strokeWidth: number;
}

function Glyph({ name, color, filled, strokeWidth }: GlyphProps & { name: IconName }) {
  const common = {
    fill: 'none',
    stroke: color,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth,
  };

  switch (name) {
    case 'search':
      return (
        <G {...common}>
          <Circle cx={10.4} cy={10.4} r={5.75} />
          <Line x1={14.75} y1={14.75} x2={20} y2={20} />
        </G>
      );

    case 'location-pin':
      return (
        <G {...common}>
          <Path d="M12 21s-6.4-5.2-6.4-11A6.4 6.4 0 0 1 18.4 10C18.4 15.8 12 21 12 21Z" fill={filled ? color : 'none'} />
          <Circle cx={12} cy={10} r={2.05} fill={filled ? colors.white : 'none'} />
        </G>
      );

    case 'shuffle':
      return (
        <G {...common}>
          <Path d="M3.5 7h3.25c4.6 0 5.55 10 10.35 10h3.4" />
          <Path d="m17.5 14 3 3-3 3" />
          <Path d="M3.5 17h3.25c1.85 0 3.05-1.55 4.2-3.5" />
          <Path d="M13.05 9.9C14.15 8.25 15.35 7 17.1 7h3.4" />
          <Path d="m17.5 4 3 3-3 3" />
        </G>
      );

    case 'back':
    case 'chevron-left':
      return <Path d="m15.8 4.5-7 7.5 7 7.5" {...common} />;

    case 'chevron-right':
      return <Path d="m8.2 4.5 7 7.5-7 7.5" {...common} />;

    case 'chevron-down':
      return <Path d="m4.5 8.2 7.5 7 7.5-7" {...common} />;

    case 'chevron-up':
      return <Path d="m4.5 15.8 7.5-7 7.5 7" {...common} />;

    case 'map':
      return (
        <G {...common}>
          <Path d="m3.5 5.1 5-2.1 7 2.1 5-2.1v15.9l-5 2.1-7-2.1-5 2.1V5.1Z" fill={filled ? color : 'none'} />
          <Path d="M8.5 3v15.9M15.5 5.1V21" stroke={filled ? colors.white : color} />
          <Path d="M12 13.2s-2.1-1.8-2.1-3.7a2.1 2.1 0 1 1 4.2 0c0 1.9-2.1 3.7-2.1 3.7Z" fill={filled ? colors.white : 'none'} stroke={filled ? colors.white : color} />
        </G>
      );

    case 'compare':
      return (
        <G {...common}>
          <Rect x={3.2} y={4.1} width={6.8} height={9.2} rx={1.3} fill={filled ? color : 'none'} />
          <Rect x={14} y={10.7} width={6.8} height={9.2} rx={1.3} fill={filled ? color : 'none'} />
          <Path d="M12.2 6.8h6.4m0 0-2.2-2.2m2.2 2.2L16.4 9" />
          <Path d="M11.8 17.2H5.4m0 0 2.2-2.2m-2.2 2.2 2.2 2.2" />
        </G>
      );

    case 'directions':
      return (
        <Path
          d="M20.4 3.6 14.1 20.3l-2.45-7.1-7.35-2.45L20.4 3.6Z"
          {...common}
          fill={filled ? color : 'none'}
        />
      );

    case 'review':
      return (
        <G {...common}>
          <Path d="M5 3.6h9.2a1.6 1.6 0 0 1 1.6 1.6v5.25M5 3.6a1.6 1.6 0 0 0-1.6 1.6v13.6A1.6 1.6 0 0 0 5 20.4h8" />
          <Path d="m13.1 18.9 1.15-3.7 5.45-5.45 2.15 2.15-5.45 5.45-3.3 1.55Z" fill={filled ? color : 'none'} />
          <Line x1={7} y1={8} x2={12.5} y2={8} />
          <Line x1={7} y1={11.5} x2={10.5} y2={11.5} />
        </G>
      );

    case 'plus':
      return (
        <G {...common}>
          <Line x1={12} y1={4.5} x2={12} y2={19.5} />
          <Line x1={4.5} y1={12} x2={19.5} y2={12} />
        </G>
      );

    case 'close':
    case 'x':
      return (
        <G {...common}>
          <Line x1={5.5} y1={5.5} x2={18.5} y2={18.5} />
          <Line x1={18.5} y1={5.5} x2={5.5} y2={18.5} />
        </G>
      );

    case 'tab-discover':
      return (
        <G {...common}>
          <Circle cx={12} cy={12} r={8.7} fill={filled ? color : 'none'} />
          <Path d="m15.4 8.6-1.9 4.9-4.9 1.9 1.9-4.9 4.9-1.9Z" fill={filled ? colors.white : 'none'} stroke={filled ? colors.white : color} />
        </G>
      );

    case 'tab-catalog':
      return (
        <G {...common}>
          <Rect x={3.5} y={4} width={7} height={7} rx={1.8} fill={filled ? color : 'none'} />
          <Rect x={13.5} y={4} width={7} height={7} rx={1.8} fill={filled ? color : 'none'} />
          <Rect x={3.5} y={14} width={7} height={6} rx={1.8} fill={filled ? color : 'none'} />
          <Rect x={13.5} y={14} width={7} height={6} rx={1.8} fill={filled ? color : 'none'} />
        </G>
      );

    case 'tab-saved':
    case 'bookmark':
      return (
        <Path
          d="M6.5 3.5h11a1 1 0 0 1 1 1V20L12 16l-6.5 4V4.5a1 1 0 0 1 1-1Z"
          {...common}
          fill={filled ? color : 'none'}
        />
      );

    case 'tab-profile':
      return (
        <G {...common}>
          <Circle cx={12} cy={8} r={3.6} fill={filled ? color : 'none'} />
          <Path d="M4.8 20c.6-3.6 3.6-5.6 7.2-5.6s6.6 2 7.2 5.6" fill={filled ? color : 'none'} />
        </G>
      );

    case 'check':
      return <Polyline points="4.5,12.2 9.4,17.1 19.8,6.7" {...common} />;

    case 'camera':
      return (
        <G {...common}>
          <Path d="M4.5 7.4h3l1.4-2.3h6.2l1.4 2.3h3A1.5 1.5 0 0 1 21 8.9v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.9v-9a1.5 1.5 0 0 1 1.5-1.5Z" fill={filled ? color : 'none'} />
          <Circle cx={12} cy={13.2} r={3.35} fill={filled ? colors.white : 'none'} />
        </G>
      );

    case 'pencil':
      return (
        <G {...common}>
          <Path d="m4.3 15.4 10.9-10.9a2 2 0 0 1 2.8 0l1.5 1.5a2 2 0 0 1 0 2.8L8.6 19.7 3.5 20.5l.8-5.1Z" fill={filled ? color : 'none'} />
          <Line x1={13.8} y1={5.9} x2={18.1} y2={10.2} />
          <Line x1={5} y1={15.3} x2={8.7} y2={19} />
        </G>
      );

    case 'filter':
      return (
        <G {...common}>
          <Line x1={4} y1={7} x2={20} y2={7} />
          <Circle cx={9} cy={7} r={2.1} fill={colors.surface} />
          <Line x1={4} y1={17} x2={20} y2={17} />
          <Circle cx={15} cy={17} r={2.1} fill={colors.surface} />
        </G>
      );

    case 'restaurant':
      return (
        <G {...common}>
          <Path d="M5 20.5V7.1L12 3l7 4.1v13.4" fill={filled ? color : 'none'} />
          <Line x1={3} y1={20.5} x2={21} y2={20.5} />
          <Rect x={9.2} y={13.2} width={5.6} height={7.3} rx={0.8} fill={filled ? colors.white : 'none'} />
          <Line x1={8} y1={9} x2={8} y2={10.5} />
          <Line x1={12} y1={9} x2={12} y2={10.5} />
          <Line x1={16} y1={9} x2={16} y2={10.5} />
        </G>
      );

    case 'dish':
      return (
        <G {...common}>
          <Path d="M4 11.8h16c-.55 5-3.4 7.2-8 7.2s-7.45-2.2-8-7.2Z" fill={filled ? color : 'none'} />
          <Path d="M7.2 10.6c.8-2.2 2.25-3.4 4.8-3.4s4 1.2 4.8 3.4" />
          <Line x1={12} y1={4.4} x2={12} y2={6.6} />
          <Line x1={3.2} y1={21} x2={20.8} y2={21} />
        </G>
      );

    case 'bell':
      return (
        <G {...common}>
          <Path d="M5.5 17.5h13l-1.5-2.2V10a5 5 0 0 0-10 0v5.3l-1.5 2.2Z" fill={filled ? color : 'none'} />
          <Path d="M9.7 20a2.55 2.55 0 0 0 4.6 0" />
        </G>
      );

    case 'settings':
      return (
        <G {...common}>
          <Circle cx={12} cy={12} r={3.2} />
          <Path d="m12 3 .9 2.1 2.25.75 2-1 2 2-.95 2.05.8 2.2 2 .9v2.8l-2 .9-.8 2.2.95 2.05-2 2-2-1-2.25.8L12 21l-.9-2.15-2.25-.8-2 1-2-2 .95-2.05-.8-2.2-2-.9V9.1l2-.9.8-2.2-.95-2.05 2-2 2 1 2.25-.85L12 3Z" />
        </G>
      );

    case 'photos':
      return (
        <G {...common}>
          <Rect x={3.5} y={5} width={17} height={14} rx={2.1} fill={filled ? color : 'none'} />
          <Circle cx={9} cy={10} r={1.7} fill={filled ? colors.white : 'none'} />
          <Path d="m5.5 17 4.3-4.2 3.1 2.7 2.5-2.1 3.1 3.6" stroke={filled ? colors.white : color} />
        </G>
      );

    case 'contributions':
      return (
        <G {...common}>
          <Rect x={4} y={4} width={16} height={16} rx={2.4} fill={filled ? color : 'none'} />
          <Line x1={12} y1={8} x2={12} y2={16} stroke={filled ? colors.white : color} />
          <Line x1={8} y1={12} x2={16} y2={12} stroke={filled ? colors.white : color} />
        </G>
      );

    case 'heart':
      return (
        <Path
          d="M12 20.5S3.7 15.9 3.7 9.3A4.6 4.6 0 0 1 12 6.5a4.6 4.6 0 0 1 8.3 2.8c0 6.6-8.3 11.2-8.3 11.2Z"
          {...common}
          fill={filled ? color : 'none'}
        />
      );
  }
}

/** A consistent 24×24 line icon used throughout the native app. */
export function Icon({
  name,
  size = 24,
  color = colors.ink,
  strokeWidth = 1.8,
  filled = false,
  accessibilityLabel,
  ...svgProps
}: IconProps) {
  return (
    <Svg
      {...svgProps}
      accessibilityLabel={accessibilityLabel}
      accessible={Boolean(accessibilityLabel)}
      height={size}
      preserveAspectRatio="xMidYMid meet"
      viewBox="0 0 24 24"
      width={size}
    >
      <Glyph color={color} filled={filled} name={name} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export const SearchIcon = (props: IconComponentProps) => <Icon {...props} name="search" />;
export const LocationPinIcon = (props: IconComponentProps) => <Icon {...props} name="location-pin" />;
export const LocationIcon = LocationPinIcon;
export const ShuffleIcon = (props: IconComponentProps) => <Icon {...props} name="shuffle" />;
export const BackIcon = (props: IconComponentProps) => <Icon {...props} name="back" />;
export const ChevronLeftIcon = (props: IconComponentProps) => <Icon {...props} name="chevron-left" />;
export const ChevronRightIcon = (props: IconComponentProps) => <Icon {...props} name="chevron-right" />;
export const ChevronDownIcon = (props: IconComponentProps) => <Icon {...props} name="chevron-down" />;
export const ChevronUpIcon = (props: IconComponentProps) => <Icon {...props} name="chevron-up" />;
export const MapIcon = (props: IconComponentProps) => <Icon {...props} name="map" />;
export const CompareIcon = (props: IconComponentProps) => <Icon {...props} name="compare" />;
export const DirectionsIcon = (props: IconComponentProps) => <Icon {...props} name="directions" />;
export const ReviewIcon = (props: IconComponentProps) => <Icon {...props} name="review" />;
export const PlusIcon = (props: IconComponentProps) => <Icon {...props} name="plus" />;
export const CloseIcon = (props: IconComponentProps) => <Icon {...props} name="close" />;
export const DiscoverTabIcon = (props: IconComponentProps) => <Icon {...props} name="tab-discover" />;
export const CatalogTabIcon = (props: IconComponentProps) => <Icon {...props} name="tab-catalog" />;
export const SavedTabIcon = (props: IconComponentProps) => <Icon {...props} name="tab-saved" />;
export const ProfileTabIcon = (props: IconComponentProps) => <Icon {...props} name="tab-profile" />;
export const CheckIcon = (props: IconComponentProps) => <Icon {...props} name="check" />;
export const XIcon = (props: IconComponentProps) => <Icon {...props} name="x" />;
export const CameraIcon = (props: IconComponentProps) => <Icon {...props} name="camera" />;
export const PencilIcon = (props: IconComponentProps) => <Icon {...props} name="pencil" />;
export const BookmarkIcon = (props: IconComponentProps) => <Icon {...props} name="bookmark" />;
export const FilterIcon = (props: IconComponentProps) => <Icon {...props} name="filter" />;
export const RestaurantIcon = (props: IconComponentProps) => <Icon {...props} name="restaurant" />;
export const DishIcon = (props: IconComponentProps) => <Icon {...props} name="dish" />;
export const BellIcon = (props: IconComponentProps) => <Icon {...props} name="bell" />;
export const SettingsIcon = (props: IconComponentProps) => <Icon {...props} name="settings" />;
export const PhotosIcon = (props: IconComponentProps) => <Icon {...props} name="photos" />;
export const ContributionsIcon = (props: IconComponentProps) => <Icon {...props} name="contributions" />;
export const HeartIcon = (props: IconComponentProps) => <Icon {...props} name="heart" />;

