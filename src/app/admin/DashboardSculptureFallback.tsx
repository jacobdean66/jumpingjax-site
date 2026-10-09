import { Banknote, CalendarDays, Mail, TicketCheck } from "lucide-react";

export function DashboardSculptureFallback() {
  return <div className="jax-scene" aria-hidden="true">
    <div className="jax-scene-floor" />
    <div className="jax-orbit jax-orbit-one" />
    <div className="jax-orbit jax-orbit-two" />
    <div className="jax-cube-float">
      <div className="jax-cube">
        <div className="jax-cube-face jax-cube-front">JAX<span>LET&apos;S PLAY</span></div>
        <div className="jax-cube-face jax-cube-back">JAX</div>
        <div className="jax-cube-face jax-cube-right"><TicketCheck size={42} /></div>
        <div className="jax-cube-face jax-cube-left"><Mail size={42} /></div>
        <div className="jax-cube-face jax-cube-top"><span>JUMPING JAX</span></div>
        <div className="jax-cube-face jax-cube-bottom" />
      </div>
    </div>
    <div className="jax-satellite jax-satellite-one"><TicketCheck /></div>
    <div className="jax-satellite jax-satellite-two"><Banknote /></div>
    <div className="jax-satellite jax-satellite-three"><Mail /></div>
    <div className="jax-satellite jax-satellite-four"><CalendarDays /></div>
  </div>;
}
