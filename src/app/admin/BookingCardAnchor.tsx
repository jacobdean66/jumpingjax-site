"use client";
import { useEffect } from "react";

export function BookingCardAnchor() {
  useEffect(() => {
    const open = () => {
      let id: string;
      try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      if (!id.startsWith("booking-")) return;
      const card = document.getElementById(id);
      if (card instanceof HTMLDetailsElement) { card.open = true; card.scrollIntoView({ block: "start" }); }
    };
    open(); window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}
