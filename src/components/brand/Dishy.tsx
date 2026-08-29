import type { ReactNode } from 'react';
import Svg, {
  Circle,
  Ellipse,
  G,
  Line,
  Path,
  Polygon,
  Polyline,
  Rect,
  type SvgProps,
} from 'react-native-svg';

import { colors } from '@/theme/tokens';

const VIEWBOX_WIDTH = 64;
const VIEWBOX_HEIGHT = 56;
const OUTLINE = colors.purpleDark;
const LINE_WIDTH = 2.35;

export type DishyVariant =
  | 'neutral'
  | 'enjoy'
  | 'discover'
  | 'compare'
  | 'map'
  | 'review'
  | 'saved'
  | 'happy';

export interface DishyProps extends Omit<SvgProps, 'height' | 'viewBox' | 'width'> {
  variant: DishyVariant;
  /** Width in density-independent pixels. Height follows the fixed scene ratio. */
  size?: number;
}

type Expression = 'happy' | 'delighted' | 'curious' | 'focused';

const expressionByVariant: Record<DishyVariant, Expression> = {
  neutral: 'happy',
  enjoy: 'delighted',
  discover: 'curious',
  compare: 'focused',
  map: 'curious',
  review: 'focused',
  saved: 'happy',
  happy: 'delighted',
};

function GroundShadow({ variant }: { variant: DishyVariant }) {
  if (variant === 'enjoy') {
    return (
      <>
        <Ellipse cx={31} cy={50.6} rx={22.5} ry={3.1} fill={colors.lavender} opacity={0.72} />
        <Ellipse cx={46} cy={50.3} rx={12.5} ry={2.75} fill={colors.yellow} opacity={0.35} />
      </>
    );
  }

  return <Ellipse cx={32} cy={49.7} rx={16} ry={2.7} fill={colors.lavender} opacity={0.68} />;
}

function Legs() {
  return (
    <G fill="none" stroke={OUTLINE} strokeLinecap="round" strokeLinejoin="round" strokeWidth={LINE_WIDTH}>
      <Path d="M26.5 37.8v6.1c0 2.1-1.25 3.35-3.35 3.35h-1.1" />
      <Path d="M37.5 37.8v6.1c0 2.1 1.25 3.35 3.35 3.35h1.1" />
    </G>
  );
}

function Body() {
  return (
    <G>
      {/* A stepped outer silhouette keeps the Dish Block geometry crisp at every size. */}
      <Path
        d="M21 7.5h22l4.5 4.5v22.5L43 39H21l-4.5-4.5V12L21 7.5Z"
        fill={OUTLINE}
      />
      <Path
        d="M21.7 10h20.6l2.7 2.7v21.1l-2.7 2.7H21.7L19 33.8V12.7l2.7-2.7Z"
        fill={colors.mascotBody}
      />
      <Path d="M22.4 11.4h18.4" stroke={colors.white} strokeLinecap="round" strokeWidth={1.1} opacity={0.82} />
    </G>
  );
}

function Cheeks() {
  return (
    <>
      <Ellipse cx={22.9} cy={27.25} rx={2.45} ry={1.42} fill={colors.blush} stroke="none" />
      <Ellipse cx={41.1} cy={27.25} rx={2.45} ry={1.42} fill={colors.blush} stroke="none" />
    </>
  );
}

function Face({ expression }: { expression: Expression }) {
  if (expression === 'delighted') {
    return (
      <G fill="none" stroke={colors.ink} strokeLinecap="round" strokeLinejoin="round">
        <Cheeks />
        <Path d="M24.3 22.75c.9 1.05 2.2 1.05 3.1 0" strokeWidth={1.75} />
        <Path d="M36.6 22.75c.9 1.05 2.2 1.05 3.1 0" strokeWidth={1.75} />
        <Path d="M28.7 28.6c1.7 2.8 4.9 2.8 6.6 0" strokeWidth={1.9} />
      </G>
    );
  }

  if (expression === 'focused') {
    return (
      <G fill="none" stroke={colors.ink} strokeLinecap="round" strokeLinejoin="round">
        <Cheeks />
        <Path d="M24.3 23.25c.8.65 1.8.65 2.6 0" strokeWidth={1.65} />
        <Path d="M37.1 23.25c.8.65 1.8.65 2.6 0" strokeWidth={1.65} />
        <Path d="M30.2 29.25c1.05.8 2.55.8 3.6 0" strokeWidth={1.7} />
      </G>
    );
  }

  if (expression === 'curious') {
    return (
      <G stroke={colors.ink} strokeLinecap="round" strokeLinejoin="round">
        <Cheeks />
        <Circle cx={25.4} cy={23.1} r={1.45} fill={colors.ink} stroke="none" />
        <Circle cx={38.6} cy={22.65} r={1.72} fill={colors.ink} stroke="none" />
        <Circle cx={32.1} cy={29.2} r={1.12} fill="none" strokeWidth={1.55} />
        <Path d="M36.3 18.95l3.8-.65" fill="none" strokeWidth={1.25} />
      </G>
    );
  }

  return (
    <G stroke={colors.ink} strokeLinecap="round" strokeLinejoin="round">
      <Cheeks />
      <Circle cx={25.5} cy={23.15} r={1.55} fill={colors.ink} stroke="none" />
      <Circle cx={38.5} cy={23.15} r={1.55} fill={colors.ink} stroke="none" />
      <Path d="M28.7 28.4c1.55 2.45 5.05 2.45 6.6 0" fill="none" strokeWidth={1.9} />
    </G>
  );
}

function NeutralArms() {
  return (
    <G fill="none" stroke={OUTLINE} strokeLinecap="round" strokeLinejoin="round" strokeWidth={LINE_WIDTH}>
      <Path d="M17.8 21.8c-3.75-2.05-6.05.25-5.45 4.25.55 3.7 3 4.55 5.85 2.25" />
      <Path d="M46.2 21.8c3.75-2.05 6.05.25 5.45 4.25-.55 3.7-3 4.55-5.85 2.25" />
    </G>
  );
}

function RaisedArms() {
  return (
    <G fill="none" stroke={OUTLINE} strokeLinecap="round" strokeLinejoin="round" strokeWidth={LINE_WIDTH}>
      <Path d="M17.6 24.5c-3.5.2-5.7-1.8-5.1-5.05.4-2.25-.3-3.65-2.35-4.15" />
      <Path d="M46.4 24.5c3.5.2 5.7-1.8 5.1-5.05-.4-2.25.3-3.65 2.35-4.15" />
    </G>
  );
}

function FourPointSparkle({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  const w = 3.5 * scale;
  const h = 4.4 * scale;
  return (
    <Polygon
      fill={colors.yellow}
      points={`${x},${y - h} ${x + w * 0.34},${y - h * 0.32} ${x + w},${y} ${x + w * 0.34},${y + h * 0.32} ${x},${y + h} ${x - w * 0.34},${y + h * 0.32} ${x - w},${y} ${x - w * 0.34},${y - h * 0.32}`}
    />
  );
}

function EnjoyRear() {
  return (
    <>
      <Path
        d="M18 23.4c-3.55-1.4-5.25.75-5.15 3.45.05 1.55-.55 2.45-1.65 2.55"
        fill="none"
        stroke={OUTLINE}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={LINE_WIDTH}
      />
      <Path
        d="M46.2 22c3.85-2.15 6.2.25 5.5 4.3-.55 3.45-3 4.2-5.75 2.05"
        fill="none"
        stroke={OUTLINE}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={LINE_WIDTH}
      />
      <G fill="none" strokeLinecap="round">
        <Line x1={7.4} y1={9.4} x2={10.5} y2={29.3} stroke={OUTLINE} strokeWidth={3.3} />
        <Line x1={10.8} y1={8.9} x2={13.4} y2={28.2} stroke={OUTLINE} strokeWidth={3.3} />
        <Line x1={7.4} y1={9.4} x2={10.5} y2={29.3} stroke={colors.yellow} strokeWidth={1.5} />
        <Line x1={10.8} y1={8.9} x2={13.4} y2={28.2} stroke={colors.yellow} strokeWidth={1.5} />
      </G>
    </>
  );
}

function NoodleBowl() {
  return (
    <G>
      <Path
        d="M45.8 41.2h16.4l-2.3 9.2c-.65 2.55-11.45 2.55-12.05 0l-2.05-9.2Z"
        fill={colors.yellow}
        stroke={OUTLINE}
        strokeLinejoin="round"
        strokeWidth={1.85}
      />
      <Ellipse cx={54} cy={41.05} rx={8.25} ry={2.75} fill={colors.mascotBody} stroke={OUTLINE} strokeWidth={1.85} />
      <Path d="M48.5 41.25c1.1-2 2.15 1.45 3.2-.25s2.05 1.25 3.15-.4 2.1 1 3.4-.1" fill="none" stroke={colors.orange} strokeLinecap="round" strokeWidth={1.4} />
      <Circle cx={50.7} cy={40.15} r={0.9} fill={colors.success} />
      <Circle cx={57.2} cy={39.8} r={0.85} fill={colors.success} />
      <Path d="M50.2 47.1c.8 1.4 2.2 1.4 3 0M54.8 47.1c.8 1.4 2.2 1.4 3 0" fill="none" stroke={colors.orange} strokeLinecap="round" strokeWidth={1.2} />
    </G>
  );
}

function DiscoverRear() {
  return (
    <>
      <Path
        d="M17.7 25.5c-3.25 1.8-4.65 4.3-2.45 6.5 1.45 1.45 3.55 1.55 5.35.25"
        fill="none"
        stroke={OUTLINE}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={LINE_WIDTH}
      />
      <Path
        d="M46.25 21.8c3.7-1.95 6.05.45 5.3 4.35-.6 3.35-2.85 4.15-5.65 2.1"
        fill="none"
        stroke={OUTLINE}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={LINE_WIDTH}
      />
    </>
  );
}

function Magnifier() {
  return (
    <G>
      <Circle cx={10.8} cy={23.15} r={7.2} fill={colors.map} stroke={OUTLINE} strokeWidth={2.15} />
      <Circle cx={10.8} cy={23.15} r={4.6} fill={colors.surface} opacity={0.42} />
      <Line x1={16.05} y1={28.2} x2={23.2} y2={35.25} stroke={OUTLINE} strokeLinecap="round" strokeWidth={4.1} />
      <Line x1={16.05} y1={28.2} x2={23.2} y2={35.25} stroke={colors.yellow} strokeLinecap="round" strokeWidth={1.8} />
      <Path d="M7.7 19.8c1.5-1.45 3.7-1.8 5.55-.85" fill="none" stroke={colors.white} strokeLinecap="round" strokeWidth={1.15} opacity={0.9} />
    </G>
  );
}

function CompareRear() {
  return (
    <G fill="none" stroke={OUTLINE} strokeLinecap="round" strokeLinejoin="round" strokeWidth={LINE_WIDTH}>
      <Path d="M18 25.3c-3.55-.75-5.9.8-7.3 3.65" />
      <Path d="M46 25.3c3.55-.75 5.9.8 7.3 3.65" />
    </G>
  );
}

function VersionCard({ side }: { side: 'left' | 'right' }) {
  const x = side === 'left' ? 3.5 : 45;
  return (
    <G>
      <Rect x={x} y={24} width={15.5} height={13.2} rx={1.4} fill={colors.lavender} stroke={OUTLINE} strokeWidth={1.75} />
      <Rect x={x + 2.1} y={26.2} width={4.1} height={3.3} rx={0.5} fill={colors.purple} />
      <Line x1={x + 7.6} y1={26.9} x2={x + 13} y2={26.9} stroke={colors.purpleDark} strokeLinecap="round" strokeWidth={1.1} />
      <Line x1={x + 7.6} y1={29.1} x2={x + 11.8} y2={29.1} stroke={colors.purpleDark} strokeLinecap="round" strokeWidth={1.1} />
      <Line x1={x + 2.1} y1={33.4} x2={x + 12.8} y2={33.4} stroke={colors.purple} strokeLinecap="round" strokeWidth={1.15} opacity={0.7} />
    </G>
  );
}

function MapRear() {
  return (
    <G fill="none" stroke={OUTLINE} strokeLinecap="round" strokeLinejoin="round" strokeWidth={LINE_WIDTH}>
      <Path d="M18 27.1c-4.1-.4-7.5 1.45-9.3 4.6" />
      <Path d="M46 27.1c4.1-.4 7.5 1.45 9.3 4.6" />
    </G>
  );
}

function FoldedMap() {
  return (
    <G>
      <Polygon points="6,29 22.5,26.5 40.5,29.4 58,26.7 58,43.3 41.2,46 23,43.1 6,45.7" fill={colors.mapPark} stroke={OUTLINE} strokeLinejoin="round" strokeWidth={1.7} />
      <Polygon points="22.5,26.5 40.5,29.4 41.2,46 23,43.1" fill={colors.surface} opacity={0.82} />
      <Polygon points="40.5,29.4 58,26.7 58,43.3 41.2,46" fill={colors.lavender} opacity={0.9} />
      <Polyline points="22.5,26.5 23,43.1 41.2,46 40.5,29.4" fill="none" stroke={OUTLINE} strokeLinejoin="round" strokeWidth={1.35} />
      <Path d="M8.2 39c5.9-4.65 11.8 3.4 18.5-1.55 5.8-4.25 10.6 2.1 16.3-.55 4.8-2.25 8.9-1.55 13.1.55" fill="none" stroke={colors.yellow} strokeDasharray="2.6 2.2" strokeLinecap="round" strokeWidth={1.6} />
      <Path d="M33.3 31.1c-3.1 0-5.15 2.25-5.15 5 0 3.85 5.15 8 5.15 8s5.15-4.15 5.15-8c0-2.75-2.05-5-5.15-5Z" fill={colors.purple} stroke={OUTLINE} strokeLinejoin="round" strokeWidth={1.3} />
      <Circle cx={33.3} cy={36.15} r={1.65} fill={colors.white} />
    </G>
  );
}

function ReviewRear() {
  return (
    <G fill="none" stroke={OUTLINE} strokeLinecap="round" strokeLinejoin="round" strokeWidth={LINE_WIDTH}>
      <Path d="M18 28.3c-3.8-.3-6.55 1.5-8.1 4.65" />
      <Path d="M46 27.3c3.65.25 5.7 2.3 6.45 5.2" />
    </G>
  );
}

function ReviewBookAndPencil() {
  return (
    <G>
      <Path d="M9.2 34.2c7.7-2.1 15.25-1.45 22.8 1.25v13c-7.55-2.7-15.1-3.35-22.8-1.25v-13Z" fill={colors.mascotBody} stroke={OUTLINE} strokeLinejoin="round" strokeWidth={1.7} />
      <Path d="M32 35.45c7.55-2.7 15.1-3.35 22.8-1.25v13c-7.7-2.1-15.25-1.45-22.8 1.25v-13Z" fill={colors.surface} stroke={OUTLINE} strokeLinejoin="round" strokeWidth={1.7} />
      <Line x1={32} y1={35.5} x2={32} y2={48.25} stroke={OUTLINE} strokeWidth={1.25} />
      <Line x1={13} y1={38} x2={26.6} y2={39.1} stroke={colors.iconMuted} strokeLinecap="round" strokeWidth={1.1} />
      <Line x1={12.8} y1={41.5} x2={25.7} y2={42.5} stroke={colors.iconMuted} strokeLinecap="round" strokeWidth={1.1} />
      <Line x1={37.4} y1={39} x2={49.6} y2={37.7} stroke={colors.iconMuted} strokeLinecap="round" strokeWidth={1.1} />
      <Line x1={37.5} y1={42.5} x2={47.3} y2={41.45} stroke={colors.iconMuted} strokeLinecap="round" strokeWidth={1.1} />
      <G transform="rotate(38 53 34)">
        <Rect x={51.5} y={25.3} width={3.8} height={18.1} rx={1.1} fill={colors.yellow} stroke={OUTLINE} strokeWidth={1.45} />
        <Path d="M51.5 25.5h3.8l-1.9-3.4-1.9 3.4Z" fill={colors.orange} stroke={OUTLINE} strokeLinejoin="round" strokeWidth={1.15} />
        <Line x1={51.7} y1={39.6} x2={55.1} y2={39.6} stroke={colors.orange} strokeWidth={1.25} />
      </G>
    </G>
  );
}

function SavedRear() {
  return (
    <G fill="none" stroke={OUTLINE} strokeLinecap="round" strokeLinejoin="round" strokeWidth={LINE_WIDTH}>
      <Path d="M18 25.5c-4.15.1-6.25 2.2-6.55 5.2" />
      <Path d="M46.2 22c3.75-2 6.05.35 5.4 4.3-.55 3.35-2.85 4.2-5.65 2.1" />
    </G>
  );
}

function Heart() {
  return (
    <Path
      d="M16.7 43c-2.55-2.65-8.6-6.7-8.6-11.2 0-3.55 4.35-5.75 7.05-2.7 2.7-4.1 8-2.15 8 1.95 0 4.6-4.15 9.1-6.45 11.95Z"
      fill={colors.blush}
      stroke={OUTLINE}
      strokeLinejoin="round"
      strokeWidth={1.8}
    />
  );
}

function RearScene({ variant }: { variant: DishyVariant }) {
  switch (variant) {
    case 'enjoy':
      return <EnjoyRear />;
    case 'discover':
      return <DiscoverRear />;
    case 'compare':
      return <CompareRear />;
    case 'map':
      return <MapRear />;
    case 'review':
      return <ReviewRear />;
    case 'saved':
      return <SavedRear />;
    case 'happy':
      return <RaisedArms />;
    default:
      return <NeutralArms />;
  }
}

function FrontScene({ variant }: { variant: DishyVariant }) {
  switch (variant) {
    case 'enjoy':
      return (
        <>
          <NoodleBowl />
          <FourPointSparkle x={9} y={5.5} scale={0.65} />
        </>
      );
    case 'discover':
      return (
        <>
          <Magnifier />
          <FourPointSparkle x={53.8} y={10.5} scale={0.58} />
        </>
      );
    case 'compare':
      return (
        <>
          <VersionCard side="left" />
          <VersionCard side="right" />
        </>
      );
    case 'map':
      return <FoldedMap />;
    case 'review':
      return <ReviewBookAndPencil />;
    case 'saved':
      return (
        <>
          <Heart />
          <FourPointSparkle x={53} y={11} scale={0.55} />
        </>
      );
    case 'happy':
      return (
        <>
          <FourPointSparkle x={9} y={8.5} scale={0.7} />
          <FourPointSparkle x={54.5} y={8} scale={0.72} />
          <FourPointSparkle x={58} y={26} scale={0.42} />
          <Circle cx={7} cy={24.5} r={1.25} fill={colors.blush} />
          <Rect x={30.8} y={3.2} width={2.4} height={2.4} fill={colors.yellow} transform="rotate(45 32 4.4)" />
        </>
      );
    default:
      return null;
  }
}

/**
 * Dishy's shared vector asset. Every scene uses the same Dish Block body,
 * facial anchors and leg geometry; variants only change expression, pose and props.
 */
export function Dishy({ variant, size = 96, accessibilityLabel, ...svgProps }: DishyProps) {
  const safeSize = Math.max(16, size);
  const showGround = safeSize >= 48;
  const children: ReactNode = (
    <>
      {showGround ? <GroundShadow variant={variant} /> : null}
      <RearScene variant={variant} />
      <Legs />
      <Body />
      <Face expression={expressionByVariant[variant]} />
      <FrontScene variant={variant} />
    </>
  );

  return (
    <Svg
      {...svgProps}
      accessibilityLabel={accessibilityLabel}
      accessible={Boolean(accessibilityLabel)}
      height={(safeSize * VIEWBOX_HEIGHT) / VIEWBOX_WIDTH}
      preserveAspectRatio="xMidYMid meet"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      width={safeSize}
    >
      {children}
    </Svg>
  );
}
