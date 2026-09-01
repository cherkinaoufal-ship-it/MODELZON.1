import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows, useGLTF, useAnimations } from "@react-three/drei";
import { ArrowLeft, User, PersonStanding } from "lucide-react";

export const Route = createFileRoute("/preview/avatar")({
  component: AvatarPreviewPage,
});

/**
 * Animated avatar preview (Idle/Walk + gender picker) — a completely
 * separate page from the Studio, on purpose. It does NOT attempt to put
 * the current garment design on this avatar: the garments in Studio3D are
 * built as free-floating procedural geometry (see buildTorsoProfile in
 * Studio3D.tsx), not skinned meshes rigged to a skeleton, so they can't
 * just be parented onto a walking figure without real per-garment rigging
 * work in Blender first. This page is the first half (a working animated
 * avatar) — dressing it is a separate, larger effort for later.
 *
 * ⚠️ REQUIRES REAL FILES THIS SANDBOX CANNOT CREATE: rigged, animated
 * human GLB models. Get free ones from Mixamo (mixamo.com — free Adobe
 * account, pick a character, download as .glb with "Idle" and "Walking"
 * animations, or export separately and merge). Place them at:
 *   public/models/avatar-male.glb
 *   public/models/avatar-female.glb
 * Each must contain animation clips named exactly "idle" and "walk" (or
 * update the ACTION_NAMES map below to match whatever Mixamo actually
 * names them in your export — this varies by character).
 * Until those files exist, this page will show a loading error, which is
 * expected and not a bug in this code.
 */

const ACTION_NAMES = { idle: "idle", walk: "walk" };

function AnimatedAvatar({ gender, action }: { gender: "male" | "female"; action: "idle" | "walk" }) {
  const group = useRef<any>(null);
  const { scene, animations } = useGLTF(`/models/avatar-${gender}.glb`);
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    const clip = actions[ACTION_NAMES[action]];
    clip?.reset().fadeIn(0.3).play();
    return () => { clip?.fadeOut(0.3); };
  }, [action, actions]);

  return <primitive ref={group} object={scene} />;
}

function AvatarFallback() {
  return (
    <mesh>
      <capsuleGeometry args={[0.4, 1.2, 4, 12]} />
      <meshStandardMaterial color="#334155" wireframe />
    </mesh>
  );
}

function AvatarPreviewPage() {
  const [gender, setGender] = useState<"male" | "female">("male");
  const [action, setAction] = useState<"idle" | "walk">("idle");
  const [showGenderPicker, setShowGenderPicker] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="p-4 flex items-center gap-2 border-b border-white/10">
        <Link to="/" className="text-white/50 hover:text-white/80"><ArrowLeft size={18} /></Link>
        <h1 className="text-sm font-black">Animated Avatar Preview</h1>
        <span className="text-[10px] text-white/30 ml-auto">Standalone — not connected to Studio</span>
      </div>

      <div className="flex-1 relative">
        <Canvas camera={{ position: [0, 1, 3.2], fov: 40 }} shadows>
          <color attach="background" args={["#000000"]} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[3, 5, 4]} intensity={1} castShadow />
          <Environment preset="studio" />
          <Suspense fallback={<AvatarFallback />}>
            <AnimatedAvatar gender={gender} action={action} />
          </Suspense>
          <ContactShadows position={[0, -1, 0]} opacity={0.6} scale={8} blur={2} />
          <OrbitControls enablePan={false} minDistance={2} maxDistance={6} target={[0, 0.9, 0]} />
        </Canvas>

        <div className="absolute bottom-4 inset-x-0 flex justify-center gap-3">
          <button
            onClick={() => setAction("idle")}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${action === "idle" ? "bg-cyan-500/30 border border-cyan-400" : "bg-white/5 border border-white/10"}`}
          >
            🧍
          </button>
          <button
            onClick={() => setAction("walk")}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${action === "walk" ? "bg-cyan-500/30 border border-cyan-400" : "bg-white/5 border border-white/10"}`}
          >
            <PersonStanding size={22} />
          </button>
          <button
            onClick={() => setShowGenderPicker(true)}
            className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center"
          >
            <User size={20} />
          </button>
        </div>

        {showGenderPicker && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center" onClick={() => setShowGenderPicker(false)}>
            <div onClick={(e) => e.stopPropagation()} className="bg-black border border-white/10 rounded-2xl p-4 flex gap-3">
              <button onClick={() => { setGender("male"); setShowGenderPicker(false); }}
                className={`px-5 py-3 rounded-xl font-bold ${gender === "male" ? "bg-cyan-500/30 border border-cyan-400" : "bg-white/5 border border-white/10"}`}>
                Male
              </button>
              <button onClick={() => { setGender("female"); setShowGenderPicker(false); }}
                className={`px-5 py-3 rounded-xl font-bold ${gender === "female" ? "bg-fuchsia-500/30 border border-fuchsia-400" : "bg-white/5 border border-white/10"}`}>
                Female
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
