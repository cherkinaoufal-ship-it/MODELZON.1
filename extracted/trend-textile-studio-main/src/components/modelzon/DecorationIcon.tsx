import type { DecorationTypeId } from "@/lib/materialPresets";

/**
 * Tiny illustrative icon for every print / embroidery treatment so the user
 * can see the effect (raised, puff, bleached, laser etched, glow...) instead
 * of reading a label only.
 */
export default function DecorationIcon({ id, size = 16 }: { id: DecorationTypeId; size?: number }) {
  const s = { width: size, height: size };
  const base = "M4 12 h16";
  const wrap = (children: React.ReactNode) => (
    <svg viewBox="0 0 24 24" style={s} className="shrink-0" aria-hidden>
      {children}
    </svg>
  );
  const c = "currentColor";

  switch (id) {
    case "screen":
      return wrap(<>
        <rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke={c} strokeWidth="1.6" />
        <path d="M7 9h10M7 13h6" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
      </>);
    case "rubber":
      return wrap(<>
        <rect x="4" y="7" width="16" height="10" rx="5" fill={c} opacity="0.75" />
        <rect x="4" y="7" width="16" height="10" rx="5" fill="none" stroke={c} strokeWidth="1.4" />
      </>);
    case "embossed":
      return wrap(<>
        <path d={base} stroke={c} strokeWidth="1.2" opacity="0.4" />
        <path d="M7 14 q5 -9 10 0" fill="none" stroke={c} strokeWidth="2" />
        <path d="M7 17 q5 -9 10 0" fill="none" stroke={c} strokeWidth="1" opacity="0.4" />
      </>);
    case "silicon":
      return wrap(<>
        <circle cx="12" cy="12" r="7" fill={c} opacity="0.35" />
        <circle cx="12" cy="12" r="7" fill="none" stroke={c} strokeWidth="1.6" />
        <circle cx="9.5" cy="9.5" r="1.6" fill="#fff" opacity="0.9" />
      </>);
    case "high-density":
      return wrap(<>
        <rect x="5" y="8" width="14" height="8" rx="1" fill={c} opacity="0.85" />
        <rect x="5" y="16" width="14" height="2" fill={c} opacity="0.4" />
      </>);
    case "puff":
      return wrap(<>
        <path d="M5 16 q3 -10 7 -10 t7 10 z" fill={c} opacity="0.55" />
        <path d="M5 16 q3 -10 7 -10 t7 10" fill="none" stroke={c} strokeWidth="1.6" />
      </>);
    case "stamp":
      return wrap(<>
        <rect x="5" y="5" width="14" height="14" rx="1" fill="none" stroke={c} strokeWidth="1.6" strokeDasharray="3 2" />
        <path d="M9 12h6M12 9v6" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
      </>);
    case "bleach":
      return wrap(<>
        <path d="M12 4 C8 10 6 12 6 15 a6 6 0 0 0 12 0 c0 -3 -2 -5 -6 -11 z" fill={c} opacity="0.3" stroke={c} strokeWidth="1.4" />
      </>);
    case "foil":
      return wrap(<>
        <rect x="4" y="7" width="16" height="10" rx="1.5" fill={c} opacity="0.4" />
        <path d="M6 17 L12 7 M11 17 L17 7" stroke="#fff" strokeWidth="1.4" opacity="0.8" />
      </>);
    case "glow":
      return wrap(<>
        <circle cx="12" cy="12" r="9" fill={c} opacity="0.15" />
        <circle cx="12" cy="12" r="6" fill={c} opacity="0.3" />
        <circle cx="12" cy="12" r="3" fill={c} />
      </>);
    case "sun":
      return wrap(<>
        <circle cx="12" cy="12" r="4" fill={c} />
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i * Math.PI) / 4;
          return <line key={i} x1={12 + Math.cos(a) * 6} y1={12 + Math.sin(a) * 6} x2={12 + Math.cos(a) * 9} y2={12 + Math.sin(a) * 9} stroke={c} strokeWidth="1.5" strokeLinecap="round" />;
        })}
      </>);
    case "laser":
      return wrap(<>
        <path d="M12 3 V11" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M8 11 h8 l-4 4 z" fill={c} />
        <path d="M5 20 h14" stroke={c} strokeWidth="1.6" strokeDasharray="2 2" />
      </>);
    case "tonal-embroidery":
      return wrap(<>
        <path d="M4 12 q4 -6 8 0 t8 0" fill="none" stroke={c} strokeWidth="2" strokeDasharray="3 2" />
        <path d="M4 16 q4 -6 8 0 t8 0" fill="none" stroke={c} strokeWidth="1.4" strokeDasharray="3 2" opacity="0.5" />
      </>);
    case "chenille":
      return wrap(<>
        {Array.from({ length: 4 }).map((_, i) => (
          <circle key={i} cx={6 + i * 4} cy={12} r={3} fill={c} opacity={0.45} />
        ))}
      </>);
    case "flat-embroidery":
      return wrap(<>
        {Array.from({ length: 7 }).map((_, i) => (
          <line key={i} x1={5 + i * 2.4} y1={8} x2={5 + i * 2.4} y2={16} stroke={c} strokeWidth="1.8" />
        ))}
      </>);
    case "puff-embroidery":
      return wrap(<>
        <path d="M5 17 q3 -11 7 -11 t7 11 z" fill={c} opacity="0.4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <line key={i} x1={7 + i * 2.4} y1={17} x2={7 + i * 2.4} y2={11 + Math.abs(2 - i)} stroke={c} strokeWidth="1.4" />
        ))}
      </>);
    case "applique":
      return wrap(<>
        <rect x="5" y="5" width="10" height="10" rx="1.5" fill={c} opacity="0.35" stroke={c} strokeWidth="1.4" />
        <rect x="9" y="9" width="10" height="10" rx="1.5" fill="none" stroke={c} strokeWidth="1.4" strokeDasharray="3 2" />
      </>);
    case "patch":
      return wrap(<>
        <path d="M6 6 h12 v9 q0 4 -6 4 q-6 0 -6 -4 z" fill={c} opacity="0.3" stroke={c} strokeWidth="1.6" />
        <path d="M8 8 h8 v7 q0 2.5 -4 2.5 q-4 0 -4 -2.5 z" fill="none" stroke={c} strokeWidth="1" strokeDasharray="2 2" />
      </>);
    default:
      return wrap(<path d={base} stroke={c} strokeWidth="2" strokeLinecap="round" />);
  }
}
