"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { roundedBox } from "@/lib/admin/3d/rounded-box";
import { FRONT_DESK_TASKS } from "@/lib/admin/navigation";
import { useAdminMotion } from "./AdminExperience";
import { DashboardSculptureFallback } from "./DashboardSculptureFallback";

type Vec3 = [number, number, number];
const COLORS = ["#77efce", "#ffcd71", "#f197df", "#89bdff"];
const POSITIONS: Vec3[] = [[-2.4, 0, 1.5], [-2.4, 0, -1.5], [2.4, 0, -1.5], [2.4, 0, 1.5]];

function Block({ size, position, color, emissive, radius = true }: { size: Vec3; position: Vec3; color: string; emissive?: boolean; radius?: boolean }) {
  return <mesh position={position} geometry={radius ? roundedBox(...size) : undefined} castShadow receiveShadow>
    {!radius && <boxGeometry args={size} />}
    <meshPhysicalMaterial color={color} roughness={.32} metalness={.18} clearcoat={.65} emissive={emissive ? color : "#000000"} emissiveIntensity={emissive ? 1.2 : 0} />
  </mesh>;
}

/* Mesh proportions and pivot layout adapted from Robot3DModel and robot3DGeometry.
   Source: coding-by-feng/ai-agent-session-center @ 0943ff5. Copyright 2026 Kason Zhan.
   MIT license retained at /licenses/ai-agent-session-center.txt. */
function JaxMascot({ animate }: { animate: boolean }) {
  const body = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!animate) return;
    const time = clock.getElapsedTime();
    if (body.current) { body.current.position.y = .12 + Math.sin(time * 1.6) * .045; body.current.rotation.y = .25 + Math.sin(time * .7) * .18; }
    if (arm.current) arm.current.rotation.z = -.8 + Math.sin(time * 2) * .25;
  });
  return <group position={[0, .32, 0]} scale={1.65}>
    <group ref={body} position={[0, .12, 0]} rotation={[0, .25, 0]}>
      <Block size={[.28, .24, .26]} position={[0, 1.32, 0]} color="#e2f0ff" />
      <Block size={[.24, .065, .025]} position={[0, 1.32, .14]} color="#062838" />
      {[-.065, .065].map(x => <Block key={x} size={[.035, .022, .01]} position={[x, 1.32, .155]} color="#77efce" emissive />)}
      <mesh position={[.05, 1.52, 0]}><cylinderGeometry args={[.007, .007, .14, 8]} /><meshStandardMaterial color="#4d6e86" /></mesh>
      <mesh position={[.05, 1.60, 0]}><sphereGeometry args={[.025, 12, 12]} /><meshStandardMaterial color="#f197df" emissive="#f197df" emissiveIntensity={2} /></mesh>
      <Block size={[.32, .38, .20]} position={[0, .87, 0]} color="#d7e7f4" />
      <Block size={[.34, .07, .22]} position={[0, .77, 0]} color="#77efce" />
      <mesh position={[0, .94, .105]}><sphereGeometry args={[.04, 16, 16]} /><meshStandardMaterial color="#77efce" emissive="#77efce" emissiveIntensity={1.5} /></mesh>
      <group position={[-.21, 1.07, 0]} rotation={[0, 0, .25]}><Block size={[.08, .26, .08]} position={[0, -.18, 0]} color="#69d1ba" /></group>
      <group ref={arm} position={[.21, 1.07, 0]} rotation={[0, 0, -.8]}><Block size={[.08, .26, .08]} position={[0, -.18, 0]} color="#69d1ba" /></group>
      {[-.09, .09].map(x => <group key={x} position={[x, .54, 0]}><Block size={[.09, .28, .09]} position={[0, -.19, 0]} color="#2a4962" /><Block size={[.10, .045, .12]} position={[0, -.36, .012]} color="#d7e7f4" /></group>)}
    </group>
  </group>;
}

function TaskObject({ index }: { index: number }) {
  const color = COLORS[index];
  if (index === 1) return <group rotation={[.3, -.4, .15]}>
    {[0, 1, 2].map(i => <mesh key={i} position={[0, i * .10, 0]} castShadow><cylinderGeometry args={[.34, .34, .075, 32]} /><meshPhysicalMaterial color={color} metalness={.68} roughness={.25} /></mesh>)}
    <mesh position={[0, .23, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[.23, .012, 8, 32]} /><meshStandardMaterial color="#fff2c8" /></mesh>
  </group>;
  return <group rotation={[-.35, .25, -.12]}>
    <Block size={[.67, .48, .12]} position={[0, 0, 0]} color="#d8e7f7" />
    {index === 0 ? <>
      <Block size={[.11, .48, .14]} position={[-.23, 0, 0]} color={color} />
      {[0, 1, 2].map(i => <Block key={i} size={[.25, .023, .014]} position={[.07, .10 - i * .09, .075]} color="#21495a" />)}
    </> : index === 2 ? <>
      <Block size={[.34, .025, .014]} position={[-.13, -.02, .075]} color="#ad74a4" />
      <Block size={[.34, .025, .014]} position={[.13, -.02, .075]} color="#ad74a4" />
      <mesh position={[0, .04, .082]}><circleGeometry args={[.09, 24]} /><meshStandardMaterial color={color} /></mesh>
    </> : <>
      <Block size={[.67, .11, .14]} position={[0, .18, 0]} color={color} />
      {[-.2, 0, .2].flatMap(x => [-.06, .065].map(y => <Block key={`${x}/${y}`} size={[.085, .05, .025]} position={[x, y, .075]} color="#719bc2" />))}
    </>}
  </group>;
}

function TaskStation({ index, animate }: { index: number; animate: boolean }) {
  const router = useRouter();
  const object = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const task = FRONT_DESK_TASKS[index];
  useFrame(({ clock }) => {
    if (!animate || !object.current) return;
    object.current.position.y = .78 + Math.sin(clock.getElapsedTime() * 1.3 + index) * .06;
    object.current.rotation.y = Math.sin(clock.getElapsedTime() * .65 + index) * .12;
  });
  return <group position={POSITIONS[index]}>
    <Block size={[1.48, .17, 1.35]} position={[0, .10, 0]} color={hovered ? "#314b66" : "#142d45"} />
    <Block size={[1.35, .035, 1.22]} position={[0, .205, 0]} color={COLORS[index]} emissive />
    <Block size={[1.25, .03, 1.12]} position={[0, .24, 0]} color="#10273b" />
    <group ref={object} position={[0, .78, 0]} scale={hovered && animate ? 1.14 : 1} onPointerOver={e => { e.stopPropagation(); setHovered(true); }} onPointerOut={() => setHovered(false)} onClick={e => { e.stopPropagation(); router.push(task.href); }}>
      <TaskObject index={index} />
    </group>
    <StationLabel label={["CHECK-IN", "DEPOSITS", "INVITATIONS", "WEEKEND"][index]} color={COLORS[index]} onClick={() => router.push(task.href)} />
  </group>;
}

function StationLabel({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 144;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#092133"; context.strokeStyle = color; context.lineWidth = 5;
    context.beginPath(); context.roundRect(4, 4, 504, 136, 20); context.fill(); context.stroke();
    context.fillStyle = color; context.font = "900 55px Arial"; context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText(label, 256, 75);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, [label, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <sprite position={[0, .14, .85]} scale={[1.8, .5, 1]} onClick={e => { e.stopPropagation(); onClick(); }}>
    <spriteMaterial map={texture} transparent depthTest={false} toneMapped={false} />
  </sprite>;
}

function BrandPlate() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 128;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#b8ffeb"; context.font = "900 70px Arial";
    context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText("JUMPING JAX", 256, 65);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return <Billboard position={[0, .2, 2.7]}><mesh><planeGeometry args={[2.8, .7]} /><meshBasicMaterial map={texture} transparent toneMapped={false} /></mesh></Billboard>;
}

function CommandDeck({ animate }: { animate: boolean }) {
  const deck = useRef<THREE.Group>(null);
  useFrame(({ pointer }, delta) => {
    if (!animate || !deck.current) return;
    deck.current.rotation.y = THREE.MathUtils.damp(deck.current.rotation.y, pointer.x * .08, 3, Math.min(delta, .1));
  });
  return <group ref={deck}>
    <Block size={[7.4, .22, 5.2]} position={[0, -.18, 0]} color="#092033" />
    <Block size={[7.25, .035, 5.05]} position={[0, -.045, 0]} color="#4bb6c2" emissive />
    <Block size={[7.1, .045, 4.9]} position={[0, 0, 0]} color="#0d253b" />
    {[-2, -1, 0, 1, 2].map(z => <Block key={z} size={[6.8, .008, .012]} position={[0, .029, z]} color="#214058" radius={false} />)}
    {[-3, -2, -1, 0, 1, 2, 3].map(x => <Block key={x} size={[.012, .008, 4.6]} position={[x, .029, 0]} color="#214058" radius={false} />)}
    <mesh position={[0, .15, 0]} receiveShadow><cylinderGeometry args={[.86, 1.06, .23, 48]} /><meshPhysicalMaterial color="#223f59" metalness={.5} roughness={.3} /></mesh>
    <mesh position={[0, .28, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[.79, .024, 8, 64]} /><meshStandardMaterial color="#77efce" emissive="#77efce" emissiveIntensity={2} /></mesh>
    <JaxMascot animate={animate} />
    {FRONT_DESK_TASKS.map((task, index) => <TaskStation key={task.id} index={index} animate={animate} />)}
    <BrandPlate />
  </group>;
}

function subscribeVisibility(callback: () => void) { document.addEventListener("visibilitychange", callback); return () => document.removeEventListener("visibilitychange", callback); }
function subscribeViewport(callback: () => void) {
  const media = window.matchMedia("(min-width: 640px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

export default function DashboardCommandScene() {
  const { enabled } = useAdminMotion();
  const visible = useSyncExternalStore(subscribeVisibility, () => !document.hidden, () => true);
  const desktop = useSyncExternalStore(subscribeViewport, () => window.matchMedia("(min-width: 640px)").matches, () => true);
  const container = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    const observer = new IntersectionObserver(entries => setInView(entries[0].isIntersecting));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const animate = enabled && visible && inView;
  if (failed) return <DashboardSculptureFallback />;
  return <div ref={container} className="jax-command-scene" data-render-mode={animate ? "animated" : "still"} aria-label="Interactive Jumping Jax 3D task stations">
    <Canvas shadows dpr={[1, 1.5]} frameloop={animate ? "always" : "demand"} camera={{ position: [7.6, 7.5, 10.3], fov: 37, zoom: desktop ? 1.5 : 1.12 }} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }} fallback={<DashboardSculptureFallback />} onCreated={({ gl, camera }) => {
      camera.lookAt(0, .2, 0);
      gl.domElement.setAttribute("data-jax-renderer", "threejs");
      gl.domElement.addEventListener("webglcontextlost", () => setFailed(true), { once: true });
    }}>
      <ambientLight intensity={1.3} />
      <hemisphereLight args={["#b9e2ff", "#153e57", 1.8]} />
      <directionalLight position={[3, 8, 6]} intensity={4} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} shadow-normalBias={.03} />
      <pointLight position={[-4, 4, -2]} intensity={22} color="#c685ef" />
      <pointLight position={[4, 3, 3]} intensity={15} color="#6be8d0" />
      <CommandDeck animate={animate} />
    </Canvas>
    <p className="jax-scene-caption">CHOOSE A STATION TO GET STARTED <span aria-hidden="true">↗</span></p>
  </div>;
}
