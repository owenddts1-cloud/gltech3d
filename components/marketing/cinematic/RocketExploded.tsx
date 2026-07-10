'use client';

import { useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  useReducedMotion,
  type MotionValue,
} from 'motion/react';

/* ────────────────────────────────────────────────────────────────────────────
   RocketExploded — scroll-driven exploded view of the "GL ROCKET".
   Fixed decorative stage (same role as MediaStage): global scroll progress
   0 → EXPLODE_END maps assembled → fully exploded, smoothed with a spring.
   Hand-built SVG, engineering-blueprint aesthetic on the warm marketing
   palette. Honors prefers-reduced-motion (static, assembled, no listeners).
   ──────────────────────────────────────────────────────────────────────────── */

const EXPLODE_END = 0.55;
const NONE = -1;

const EXPLODE_SPRING = { stiffness: 64, damping: 18, mass: 0.9 };
const HOVER_SPRING = { stiffness: 260, damping: 26 };
const TILT_SPRING = { stiffness: 70, damping: 16, mass: 0.6 };

const TAN = '#A6815C';
const TAN_DEEP = '#8E6D4D';

interface PartDef {
  index: number;
  label: string;
  side: 'left' | 'right';
  /** y of the callout line (assembled, part-local coords) */
  labelY: number;
  /** x where the callout dot touches the part */
  edgeX: number;
  /** length of the callout line */
  lineLen: number;
  /** exploded offsets at progress = 1 */
  offset: { x: number; y: number; rotate: number };
  /** invisible hover hit area (assembled coords, moves with the part) */
  hit: { x: number; y: number; w: number; h: number };
}

const PARTS: readonly PartDef[] = [
  {
    index: 0,
    label: '01 · OGIVA',
    side: 'right',
    labelY: 108,
    edgeX: 186,
    lineLen: 46,
    offset: { x: -14, y: -170, rotate: -10 },
    hit: { x: 120, y: 55, w: 80, h: 98 },
  },
  {
    index: 1,
    label: '02 · RECUPERAÇÃO',
    side: 'left',
    labelY: 174,
    edgeX: 128,
    lineLen: 46,
    offset: { x: 10, y: -110, rotate: 4 },
    hit: { x: 122, y: 150, w: 76, h: 48 },
  },
  {
    index: 2,
    label: '03 · AVIÔNICA',
    side: 'right',
    labelY: 221,
    edgeX: 192,
    lineLen: 46,
    offset: { x: -16, y: -55, rotate: -3 },
    hit: { x: 122, y: 198, w: 76, h: 48 },
  },
  {
    index: 3,
    label: '04 · CORPO',
    side: 'left',
    labelY: 336,
    edgeX: 128,
    lineLen: 46,
    offset: { x: 6, y: 14, rotate: 0 },
    hit: { x: 122, y: 246, w: 76, h: 192 },
  },
  {
    index: 4,
    label: '05 · EMPENAS',
    side: 'right',
    labelY: 468,
    edgeX: 228,
    lineLen: 40,
    offset: { x: 0, y: 120, rotate: 0 },
    hit: { x: 88, y: 350, w: 144, h: 118 },
  },
  {
    index: 5,
    label: '06 · MOTOR',
    side: 'left',
    labelY: 462,
    edgeX: 132,
    lineLen: 46,
    offset: { x: -8, y: 190, rotate: 6 },
    hit: { x: 130, y: 434, w: 60, h: 48 },
  },
] as const;

const PART_TRANSFORM_STYLE: CSSProperties = {
  transformBox: 'fill-box',
  transformOrigin: 'center',
};

interface PartGroupProps {
  def: PartDef;
  explode: MotionValue<number>;
  hovered: MotionValue<number>;
  interactive: boolean;
  children: ReactNode;
}

/**
 * One exploding part: translates/rotates with scroll progress, carries its
 * own blueprint callout (dot + dashed line + label) and an invisible hit
 * area for hover highlighting. All animation runs on motion values — no
 * React re-renders during scroll or hover.
 */
function PartGroup({ def, explode, hovered, interactive, children }: PartGroupProps) {
  const x = useTransform(explode, [0, 1], [0, def.offset.x]);
  const y = useTransform(explode, [0, 1], [0, def.offset.y]);
  const rotate = useTransform(explode, [0, 1], [0, def.offset.rotate]);

  const hoverAmt = useSpring(
    useTransform(hovered, (h): number => (h === def.index ? 1 : 0)),
    HOVER_SPRING,
  );
  const othersAmt = useSpring(
    useTransform(hovered, (h): number => (h !== NONE && h !== def.index ? 1 : 0)),
    HOVER_SPRING,
  );

  const scale = useTransform(hoverAmt, (v) => 1 + v * 0.04);
  const opacity = useTransform(othersAmt, (v) => 1 - v * 0.42);
  const filter = useTransform(hoverAmt, (v) => `brightness(${1 + v * 0.07})`);

  // Labels fade in once the diagram is mostly exploded — or when hovered.
  const labelFromScroll = useTransform(explode, [0.55, 0.9], [0, 1]);
  const labelOpacity = useTransform(
    [labelFromScroll, hoverAmt],
    (latest: number[]) => Math.max(latest[0] ?? 0, latest[1] ?? 0),
  );

  const isRight = def.side === 'right';
  const endX = isRight ? def.edgeX + def.lineLen : def.edgeX - def.lineLen;
  const textX = isRight ? endX + 6 : endX - 6;

  return (
    <motion.g style={{ x, y, rotate, scale, opacity, filter, ...PART_TRANSFORM_STYLE }}>
      {children}

      {/* Blueprint callout: dot → dashed leader line → label */}
      <motion.g style={{ opacity: labelOpacity }}>
        <circle cx={def.edgeX} cy={def.labelY} r={2.2} fill={TAN} />
        <line
          x1={def.edgeX}
          y1={def.labelY}
          x2={endX}
          y2={def.labelY}
          stroke={TAN}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <text
          x={textX}
          y={def.labelY + 3}
          textAnchor={isRight ? 'start' : 'end'}
          fontSize={9}
          fontWeight={700}
          letterSpacing={2.5}
          fill={TAN_DEEP}
          className="font-sora"
          style={{ textTransform: 'uppercase' }}
        >
          {def.label}
        </text>
      </motion.g>

      {/* Invisible hover hit area (rides along with the part) */}
      {interactive ? (
        <rect
          x={def.hit.x}
          y={def.hit.y}
          width={def.hit.w}
          height={def.hit.h}
          fill="transparent"
          style={{ pointerEvents: 'all', cursor: 'crosshair' }}
          onPointerEnter={() => hovered.set(def.index)}
          onPointerLeave={() => hovered.set(NONE)}
        />
      ) : null}
    </motion.g>
  );
}

export function RocketExploded(props: { visible: boolean; className?: string }): JSX.Element {
  const { visible, className } = props;
  const reduced = useReducedMotion() ?? false;

  // Scroll → explosion progress (0 = assembled, 1 = fully exploded).
  const { scrollYProgress } = useScroll();
  const explodeRaw = useTransform(scrollYProgress, [0, EXPLODE_END], [0, 1]);
  const explodeSpring = useSpring(explodeRaw, EXPLODE_SPRING);
  const assembled = useMotionValue(0);
  const explode = reduced ? assembled : explodeSpring;

  // Hovered part index lives in a motion value: zero re-renders on hover.
  const hovered = useMotionValue(NONE);

  // Gentle parallax tilt toward the cursor.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateX = useSpring(useTransform(py, (v) => v * -3), TILT_SPRING);
  const rotateY = useSpring(useTransform(px, (v) => v * 4), TILT_SPRING);
  const shiftX = useSpring(useTransform(px, (v) => v * 10), TILT_SPRING);
  const shiftY = useSpring(useTransform(py, (v) => v * 8), TILT_SPRING);

  useEffect(() => {
    if (reduced) return;
    const onMove = (e: PointerEvent) => {
      px.set((e.clientX / window.innerWidth - 0.5) * 2);
      py.set((e.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [reduced, px, py]);

  // The diagram zooms out a touch as it opens up, to keep everything framed.
  const rocketScale = useTransform(explode, [0, 1], [1, 0.94]);
  // Central dashed axis "draws in" as parts separate.
  const axisOpacity = useTransform(explode, [0.1, 0.6], [0, 0.55]);
  const axisScaleY = useTransform(explode, [0.05, 0.7], [0.1, 1]);
  const captionOpacity = useTransform(explode, [0.6, 0.95], [0, 1]);

  const interactive = visible && !reduced;

  // Fin splay (inside the EMPENAS group): outward + rotate.
  const finSplayL = useTransform(explode, [0, 1], [0, -52]);
  const finSplayR = useTransform(explode, [0, 1], [0, 52]);
  const finRotL = useTransform(explode, [0, 1], [0, -14]);
  const finRotR = useTransform(explode, [0, 1], [0, 14]);

  const part = (i: number): PartDef => {
    const def = PARTS[i];
    if (!def) throw new Error(`RocketExploded: missing part def ${i}`);
    return def;
  };

  return (
    <motion.div
      aria-hidden
      className={`fixed inset-0 z-[5] pointer-events-none flex items-center justify-center overflow-hidden ${className ?? ''}`}
      initial={false}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
      style={{ perspective: 1200 }}
    >
      {/* Blueprint grid, radially masked toward the center */}
      <div className="absolute inset-0 cine-blueprint" />

      {/* Rotating conic glow ring behind the rocket */}
      <motion.div
        className="absolute w-[560px] h-[560px] max-w-[92vw] max-h-[92vw] rounded-full cine-ring"
        style={{ '--ring': TAN } as CSSProperties}
        animate={reduced ? undefined : { rotate: 360 }}
        transition={{ duration: 26, ease: 'linear', repeat: Infinity }}
      />
      {/* Soft warm halo */}
      <div className="absolute w-[380px] h-[380px] max-w-[70vw] max-h-[70vw] rounded-full blur-3xl bg-[#A6815C] opacity-[0.13]" />

      {/* Radial vignette to focus the center */}
      <div className="absolute inset-0 cine-vignette" />

      {/* Tilting rocket group */}
      <motion.div
        className="relative"
        style={
          reduced
            ? undefined
            : { rotateX, rotateY, x: shiftX, y: shiftY, scale: rocketScale }
        }
      >
        <svg
          viewBox="0 0 320 560"
          className="overflow-visible"
          style={{
            height: 'min(70vh, 560px)',
            width: 'auto',
            filter: 'drop-shadow(0 18px 30px rgba(45, 36, 30, 0.22))',
          }}
        >
          <defs>
            <linearGradient id="glr-metal" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#A8A199" />
              <stop offset="0.28" stopColor="#F1EEE8" />
              <stop offset="0.55" stopColor="#D6D1C8" />
              <stop offset="1" stopColor="#8F8880" />
            </linearGradient>
            <linearGradient id="glr-tan" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#C79E73" />
              <stop offset="0.45" stopColor="#A6815C" />
              <stop offset="1" stopColor="#7E603F" />
            </linearGradient>
            <linearGradient id="glr-red" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#D2483D" />
              <stop offset="0.45" stopColor="#B0322A" />
              <stop offset="1" stopColor="#7E1E18" />
            </linearGradient>
            <linearGradient id="glr-fin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3A3430" />
              <stop offset="1" stopColor="#171412" />
            </linearGradient>
            <linearGradient id="glr-boattail" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#6A645D" />
              <stop offset="1" stopColor="#37322C" />
            </linearGradient>
            <linearGradient id="glr-nozzle" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#4A4540" />
              <stop offset="1" stopColor="#211D1A" />
            </linearGradient>
          </defs>

          {/* Central dashed explosion axis (behind everything) */}
          <motion.line
            x1={160}
            y1={-60}
            x2={160}
            y2={640}
            stroke={TAN}
            strokeWidth={1}
            strokeDasharray="4 6"
            style={{ opacity: axisOpacity, scaleY: axisScaleY, ...PART_TRANSFORM_STYLE }}
          />

          {/* ── 05 · EMPENAS (fins — behind the body) ──────────────────── */}
          <PartGroup def={part(4)} explode={explode} hovered={hovered} interactive={interactive}>
            {/* back fin, seen edge-on behind the body */}
            <polygon points="154,368 166,368 170,450 150,450" fill="#211D1A" />
            {/* left fin */}
            <motion.g style={{ x: finSplayL, rotate: finRotL, ...PART_TRANSFORM_STYLE }}>
              <polygon points="130,356 96,430 96,462 130,436" fill="url(#glr-fin)" />
              <polygon points="130,356 118,382 118,444 130,436" fill="#FFFFFF" opacity={0.08} />
            </motion.g>
            {/* right fin */}
            <motion.g style={{ x: finSplayR, rotate: finRotR, ...PART_TRANSFORM_STYLE }}>
              <polygon points="190,356 224,430 224,462 190,436" fill="url(#glr-fin)" />
              <polygon points="190,356 202,382 202,444 190,436" fill="#FFFFFF" opacity={0.1} />
            </motion.g>
          </PartGroup>

          {/* ── 06 · MOTOR (boat tail + nozzle) ────────────────────────── */}
          <PartGroup def={part(5)} explode={explode} hovered={hovered} interactive={interactive}>
            <path d="M134 436 L186 436 L174 458 L146 458 Z" fill="url(#glr-boattail)" />
            <path d="M148 458 L172 458 L166 476 L154 476 Z" fill="url(#glr-nozzle)" />
            <ellipse cx={160} cy={476} rx={6} ry={2.4} fill="#141110" />
            <rect x={134} y={436} width={52} height={2.5} fill="#000000" opacity={0.18} />
          </PartGroup>

          {/* ── 04 · CORPO (body tube) ─────────────────────────────────── */}
          <PartGroup def={part(3)} explode={explode} hovered={hovered} interactive={interactive}>
            <rect x={130} y={246} width={60} height={190} fill="url(#glr-metal)" />
            {/* brand stripe at the coupler */}
            <rect x={130} y={246} width={60} height={6} fill={TAN} />
            <rect x={130} y={430} width={60} height={3} fill="#000000" opacity={0.12} />
            {/* soft specular highlight */}
            <rect x={140} y={252} width={5} height={178} fill="#FFFFFF" opacity={0.28} rx={2.5} />
            {/* launch lugs / rail buttons */}
            <rect x={189} y={286} width={7} height={14} rx={2} fill="#24201C" />
            <rect x={189} y={396} width={7} height={14} rx={2} fill="#24201C" />
            {/* vertical brand mark */}
            <text
              transform="rotate(-90 160 341)"
              x={160}
              y={345}
              textAnchor="middle"
              fontSize={14}
              fontWeight={800}
              letterSpacing={5}
              fill="#4A413A"
              className="font-sora"
            >
              GL ROCKET
            </text>
          </PartGroup>

          {/* ── 03 · AVIÔNICA (red flight computer — the signature part) ─ */}
          <PartGroup def={part(2)} explode={explode} hovered={hovered} interactive={interactive}>
            <rect x={130} y={198} width={60} height={46} fill="url(#glr-red)" />
            <rect x={130} y={198} width={60} height={2.5} fill="#000000" opacity={0.2} />
            <rect x={130} y={241.5} width={60} height={2.5} fill="#000000" opacity={0.25} />
            {/* inspection window with PCB */}
            <rect x={138} y={205} width={32} height={32} rx={3} fill="#5E1512" />
            <rect x={141} y={208} width={26} height={26} rx={2} fill="#2D241E" />
            {/* traces */}
            <path
              d="M144 214 H158 V222 H164 M144 220 H152 V230 H160"
              stroke="#C9856F"
              strokeWidth={1}
              fill="none"
            />
            {/* chip */}
            <rect x={152} y={212} width={8} height={8} rx={1} fill="#4A413A" />
            {/* LEDs on the board */}
            <circle cx={146} cy={228} r={1.6} fill="#E8C06A" />
            <circle cx={162} cy={214} r={1.6} fill="#D2483D" />
            {/* status LEDs strip */}
            <circle cx={179} cy={211} r={1.8} fill="#E8C06A" />
            <circle cx={179} cy={218} r={1.8} fill="#F3D9D5" />
            <circle cx={179} cy={225} r={1.8} fill="#7E1E18" />
            {/* corner screws */}
            <circle cx={134.5} cy={202.5} r={1.4} fill="#6E1813" />
            <circle cx={185.5} cy={202.5} r={1.4} fill="#6E1813" />
            <circle cx={134.5} cy={239.5} r={1.4} fill="#6E1813" />
            <circle cx={185.5} cy={239.5} r={1.4} fill="#6E1813" />
            <text
              x={179}
              y={236}
              textAnchor="middle"
              fontSize={4.5}
              fontWeight={700}
              letterSpacing={0.5}
              fill="#F3D9D5"
              className="font-sora"
            >
              AV·01
            </text>
          </PartGroup>

          {/* ── 02 · RECUPERAÇÃO (parachute module) ────────────────────── */}
          <PartGroup def={part(1)} explode={explode} hovered={hovered} interactive={interactive}>
            <rect x={130} y={152} width={60} height={44} fill="url(#glr-tan)" />
            <rect x={130} y={152} width={60} height={4} fill="#6E5336" />
            <rect x={130} y={192} width={60} height={4} fill="#6E5336" />
            <rect x={140} y={158} width={4} height={32} fill="#FFFFFF" opacity={0.22} rx={2} />
            <circle cx={172} cy={174} r={2.6} fill="#4A3A28" />
          </PartGroup>

          {/* ── 01 · OGIVA (nose cone) ─────────────────────────────────── */}
          <PartGroup def={part(0)} explode={explode} hovered={hovered} interactive={interactive}>
            <path
              d="M160 60 C 174 84, 188 116, 190 150 L130 150 C 132 116, 146 84, 160 60 Z"
              fill="url(#glr-metal)"
            />
            {/* shoulder */}
            <rect x={132} y={150} width={56} height={4} fill="#8F8880" />
            {/* specular streak */}
            <path
              d="M154 74 C 148 92, 143 118, 142 144 L 147 144 C 148 116, 152 92, 157 76 Z"
              fill="#FFFFFF"
              opacity={0.35}
            />
          </PartGroup>
        </svg>
      </motion.div>

      {/* Blueprint caption — appears once the diagram is fully open */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 bottom-[7vh]"
        style={{ opacity: reduced ? 0 : captionOpacity }}
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#8E6D4D] font-sora whitespace-nowrap">
          Vista explodida · GL Rocket · MK-01
        </span>
      </motion.div>
    </motion.div>
  );
}
