import { Brush, SprayCan, Pipette, MousePointer2, Eraser, PaintBucket, Image as ImageIcon, Undo2, PenTool } from "lucide-react";
import { motion } from "framer-motion";
import { useRef } from "react";

export type BrushMode = "spray" | "brush" | "eraser" | "bucket" | "none";

interface Props {
  brushMode: BrushMode;
  setBrushMode: (m: BrushMode) => void;
  brushSize: number;
  setBrushSize: (n: number) => void;
  paintColor: string;
  setPaintColor: (c: string) => void;
  palette: string[];
  onUploadImage?: (dataUrl: string) => void;
  onUndo?: () => void;
}

export default function PaintToolbar({
  brushMode, setBrushMode, brushSize, setBrushSize, paintColor, setPaintColor, palette,
  onUploadImage, onUndo,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const tools: { id: BrushMode; icon: any; label: string }[] = [
    { id: "none", icon: MousePointer2, label: "Select" },
    { id: "brush", icon: PenTool, label: "Pen" },
    { id: "spray", icon: SprayCan, label: "Spray" },
    { id: "eraser", icon: Eraser, label: "Eraser" },
    { id: "bucket", icon: PaintBucket, label: "Fill" },
  ];

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !onUploadImage) return;
    const r = new FileReader();
    r.onload = () => onUploadImage(String(r.result));
    r.readAsDataURL(f);
    e.target.value = "";
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 px-3 py-2 rounded-2xl bg-black/70 backdrop-blur-xl border border-white/10 shadow-[0_0_25px_rgba(6,182,212,0.15)]">
      {tools.map((t) => {
        const active = brushMode === t.id;
        const Icon = t.icon;
        return (
          <motion.button
            key={t.id}
            whileTap={{ scale: 0.88 }}
            onClick={() => setBrushMode(t.id)}
            className={`p-2 rounded-lg transition ${
              active
                ? "bg-gradient-to-br from-cyan-400 to-fuchsia-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.7)]"
                : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
            title={t.label}
          >
            <Icon size={15} />
          </motion.button>
        );
      })}

      <div className="w-px h-6 bg-white/10 mx-0.5" />

      <button
        onClick={() => fileRef.current?.click()}
        className="p-2 rounded-lg text-white/70 hover:text-cyan-300 hover:bg-cyan-500/10"
        title="Upload image to garment"
      >
        <ImageIcon size={15} />
      </button>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

      <button
        onClick={() => onUndo?.()}
        className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5"
        title="Undo"
      >
        <Undo2 size={15} />
      </button>

      <div className="w-px h-6 bg-white/10 mx-0.5" />

      <div className="flex items-center gap-1.5">
        <input
          type="range"
          min={1}
          max={40}
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="w-16 sm:w-20 accent-cyan-400"
        />
        <span className="text-[10px] text-cyan-300 font-mono w-5">{brushSize}</span>
      </div>

      <div className="w-px h-6 bg-white/10 mx-0.5" />

      <div className="flex items-center gap-1">
        <Pipette size={13} className="text-white/50" />
        {palette.slice(0, 6).map((c) => (
          <button
            key={c}
            onClick={() => setPaintColor(c)}
            className={`w-4 h-4 rounded-full border-2 transition ${
              paintColor === c ? "border-white scale-110" : "border-white/20"
            }`}
            style={{ background: c, boxShadow: paintColor === c ? `0 0 8px ${c}` : "none" }}
          />
        ))}
        <input
          type="color"
          value={paintColor}
          onChange={(e) => setPaintColor(e.target.value)}
          className="w-5 h-5 rounded cursor-pointer bg-transparent border border-white/20"
        />
      </div>

      <div className="w-full sm:hidden" />
      <div className="hidden sm:block">
        <Brush size={0} />
      </div>
    </div>
  );
}
