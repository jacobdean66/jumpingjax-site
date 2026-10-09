"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import { Sparkles } from "lucide-react";

const MOTION_KEY = "jumpingjax-admin-motion";
const MOTION_EVENT = "jumpingjax-admin-motion-change";
let memoryPreference: boolean | undefined;
function motionSnapshot() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  try { return memoryPreference ?? localStorage.getItem(MOTION_KEY) !== "off"; }
  catch { return memoryPreference ?? true; }
}
function subscribeMotion(listener: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", listener);
  window.addEventListener("storage", listener);
  window.addEventListener(MOTION_EVENT, listener);
  return () => {
    media.removeEventListener("change", listener);
    window.removeEventListener("storage", listener);
    window.removeEventListener(MOTION_EVENT, listener);
  };
}
const MotionContext = createContext({ enabled: true, toggle: () => {} });
export function useAdminMotion() { return useContext(MotionContext); }
export function AdminMotionToggle() {
  const motion = useAdminMotion();
  return <button type="button" onClick={motion.toggle} aria-pressed={motion.enabled} className="admin-motion-toggle" title="Turn decorative dashboard motion on or off">
    <Sparkles size={16} aria-hidden="true" /> Motion {motion.enabled ? "on" : "off"}
  </button>;
}
export function AdminExperience({ children }: { children: React.ReactNode }) {
  const enabled = useSyncExternalStore(subscribeMotion, motionSnapshot, () => true);
  function toggle() {
    try { localStorage.setItem(MOTION_KEY, enabled ? "off" : "on"); memoryPreference = undefined; }
    catch { memoryPreference = !enabled; }
    window.dispatchEvent(new Event(MOTION_EVENT));
  }
  return <MotionContext.Provider value={{ enabled, toggle }}>
    <div className="admin-experience" data-motion={enabled ? "on" : "off"}>{children}</div>
  </MotionContext.Provider>;
}
