import { useEffect, useState } from "react";

export default function EqualizerStrip({ active }: { active: boolean }) {
  const [bars, setBars] = useState<number[]>(Array(18).fill(0.2));

  useEffect(() => {
    if (!active) {
      setBars(Array(18).fill(0.1));
      return;
    }
    const id = setInterval(() => {
      setBars((prev) => prev.map(() => 0.2 + Math.random() * 0.8));
    }, 120);
    return () => clearInterval(id);
  }, [active]);

  return (
    <div className="flex items-end gap-[3px] h-8">
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-1 rounded-full transition-all duration-150"
          style={{
            height: `${h * 100}%`,
            background: `linear-gradient(to top, #06b6d4, #d946ef)`,
            boxShadow: active ? "0 0 8px #06b6d4" : "none",
          }}
        />
      ))}
    </div>
  );
}
