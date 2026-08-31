import type { BrushId } from "@/lib/paint-engine";

/**
 * Tiny SVG "stroke sample" for every brush in the library.
 * Each preview draws the same S-curve path so the difference between a
 * marker, a pencil and a neon glow reads instantly at a glance.
 */
const PATH = "M4 20 C 14 4, 30 30, 44 12";

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 48 32" className="w-full h-6 overflow-visible" aria-hidden>
      {children}
    </svg>
  );
}

export default function BrushPreview({ id, color = "currentColor" }: { id: BrushId; color?: string }) {
  switch (id) {
    case "pen":
      return (
        <Wrap>
          <path d={PATH} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
        </Wrap>
      );
    case "marker":
      return (
        <Wrap>
          <path d={PATH} fill="none" stroke={color} strokeWidth={7} strokeLinecap="butt" opacity={0.85} />
        </Wrap>
      );
    case "pencil":
      return (
        <Wrap>
          <path d={PATH} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeDasharray="1 1.6" opacity={0.9} />
          <path d={PATH} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" strokeDasharray="0.6 3" opacity={0.35} />
        </Wrap>
      );
    case "calligraphy":
      return (
        <Wrap>
          <path d={PATH} fill="none" stroke={color} strokeWidth={9} strokeLinecap="butt" transform="skewX(-22)" />
        </Wrap>
      );
    case "airbrush":
      return (
        <Wrap>
          <path d={PATH} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" opacity={0.18} />
          <path d={PATH} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" opacity={0.35} />
          <path d={PATH} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" opacity={0.7} />
        </Wrap>
      );
    case "spray":
      return (
        <Wrap>
          {Array.from({ length: 46 }).map((_, i) => {
            const tt = i / 45;
            // sample the S-curve roughly with a sine wiggle
            const x = 4 + tt * 40;
            const y = 20 - Math.sin(tt * Math.PI) * 14 + (i % 5) * 1.4 - 3;
            return <circle key={i} cx={x} cy={y} r={(i % 3) * 0.5 + 0.6} fill={color} opacity={0.55} />;
          })}
        </Wrap>
      );
    case "glow":
      return (
        <Wrap>
          <path d={PATH} fill="none" stroke={color} strokeWidth={11} strokeLinecap="round" opacity={0.15} />
          <path d={PATH} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" opacity={0.35} />
          <path d={PATH} fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
        </Wrap>
      );
    case "stitch-straight":
      return (
        <Wrap>
          <path d={PATH} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeDasharray="5 3" />
        </Wrap>
      );
    case "stitch-broken":
      return (
        <Wrap>
          <path d={PATH} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="butt" strokeDasharray="2 5" />
        </Wrap>
      );
    case "stitch-rect":
      return (
        <Wrap>
          {Array.from({ length: 6 }).map((_, i) => (
            <rect key={i} x={5 + i * 7} y={19 - Math.sin((i / 5) * Math.PI) * 12} width={5} height={4} fill="none" stroke={color} strokeWidth={1.6} />
          ))}
        </Wrap>
      );
    case "stitch-blanket":
      return (
        <Wrap>
          <path d={PATH} fill="none" stroke={color} strokeWidth={2} />
          {Array.from({ length: 6 }).map((_, i) => {
            const x = 6 + i * 7;
            const y = 20 - Math.sin((i / 5) * Math.PI) * 12;
            return <line key={i} x1={x} y1={y} x2={x} y2={y + 7} stroke={color} strokeWidth={1.6} />;
          })}
        </Wrap>
      );
    case "stitch-feather":
      return (
        <Wrap>
          <path d={PATH} fill="none" stroke={color} strokeWidth={1.6} />
          {Array.from({ length: 7 }).map((_, i) => {
            const x = 5 + i * 6;
            const y = 20 - Math.sin((i / 6) * Math.PI) * 12;
            const up = i % 2 === 0 ? -6 : 6;
            return <line key={i} x1={x} y1={y} x2={x + 4} y2={y + up} stroke={color} strokeWidth={1.6} strokeLinecap="round" />;
          })}
        </Wrap>
      );
    case "stitch-frayed":
      return (
        <Wrap>
          <path d={PATH} fill="none" stroke={color} strokeWidth={2} opacity={0.8} />
          {Array.from({ length: 14 }).map((_, i) => {
            const x = 4 + i * 3;
            const y = 20 - Math.sin((i / 13) * Math.PI) * 12;
            return <line key={i} x1={x} y1={y} x2={x + (i % 2 ? 2 : -2)} y2={y + (i % 3 ? 4 : -4)} stroke={color} strokeWidth={0.9} opacity={0.7} />;
          })}
        </Wrap>
      );
    case "stitch-overlock":
      return (
        <Wrap>
          <path d="M4 22 L10 10 L16 22 L22 10 L28 22 L34 10 L40 22 L44 14" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </Wrap>
      );
    case "stitch-satin":
      return (
        <Wrap>
          {Array.from({ length: 16 }).map((_, i) => {
            const x = 5 + i * 2.6;
            const y = 20 - Math.sin((i / 15) * Math.PI) * 12;
            return <line key={i} x1={x} y1={y - 4} x2={x} y2={y + 4} stroke={color} strokeWidth={2.2} />;
          })}
        </Wrap>
      );
    case "zipper":
      return (
        <Wrap>
          <line x1={4} y1={16} x2={44} y2={16} stroke={color} strokeWidth={2} />
          {Array.from({ length: 12 }).map((_, i) => (
            <rect key={i} x={4 + i * 3.4} y={i % 2 ? 17 : 9} width={2.4} height={6} fill={color} opacity={0.9} />
          ))}
        </Wrap>
      );
    case "zipper-sketch":
      return (
        <Wrap>
          <line x1={4} y1={16} x2={44} y2={16} stroke={color} strokeWidth={1.4} strokeDasharray="3 2" />
          {Array.from({ length: 10 }).map((_, i) => (
            <rect key={i} x={5 + i * 4} y={i % 2 ? 17 : 10} width={2.6} height={5} fill="none" stroke={color} strokeWidth={1.1} />
          ))}
        </Wrap>
      );
    case "chain":
      return (
        <Wrap>
          {Array.from({ length: 7 }).map((_, i) => (
            <ellipse key={i} cx={7 + i * 6} cy={16} rx={4} ry={i % 2 ? 3 : 6} fill="none" stroke={color} strokeWidth={1.6} />
          ))}
        </Wrap>
      );
    case "rip":
      return (
        <Wrap>
          <path d="M4 18 L12 12 L14 20 L22 11 L26 21 L34 12 L38 20 L44 14" fill="none" stroke={color} strokeWidth={2.4} strokeLinejoin="miter" />
          {Array.from({ length: 8 }).map((_, i) => (
            <line key={i} x1={6 + i * 5} y1={20} x2={7 + i * 5} y2={26} stroke={color} strokeWidth={0.9} opacity={0.6} />
          ))}
        </Wrap>
      );
    case "camo":
      return (
        <Wrap>
          <path d="M5 10 q6 -6 12 0 q5 6 -2 9 q-9 4 -12 -2 z" fill={color} opacity={0.75} />
          <path d="M22 18 q7 -9 14 -3 q6 5 -2 9 q-9 4 -12 -2 z" fill={color} opacity={0.45} />
          <path d="M33 6 q7 -3 10 4 q2 5 -5 5 q-7 0 -5 -9 z" fill={color} opacity={0.6} />
        </Wrap>
      );
    case "denim":
      return (
        <Wrap>
          {Array.from({ length: 11 }).map((_, i) => (
            <line key={i} x1={2 + i * 4} y1={30} x2={12 + i * 4} y2={2} stroke={color} strokeWidth={1.4} opacity={0.65} />
          ))}
          {Array.from({ length: 5 }).map((_, i) => (
            <line key={`h${i}`} x1={2} y1={4 + i * 6} x2={46} y2={4 + i * 6} stroke={color} strokeWidth={0.8} opacity={0.3} />
          ))}
        </Wrap>
      );
    case "sequin":
      return (
        <Wrap>
          {Array.from({ length: 14 }).map((_, i) => {
            const x = 5 + (i % 7) * 6.2;
            const y = i < 7 ? 11 : 21;
            return <circle key={i} cx={x} cy={y} r={2.6} fill={color} opacity={i % 3 ? 0.85 : 0.4} stroke="#fff" strokeWidth={0.5} />;
          })}
        </Wrap>
      );
    default:
      return (
        <Wrap>
          <path d={PATH} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
        </Wrap>
      );
  }
}
