"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { waiverCopy, type WaiverLanguage } from "@/lib/waivers/localization";

type SignaturePadProps = {
  onSignatureChange: (value: {
    present: boolean;
    contentType: "image/png" | "";
  }) => void;
  disabled?: boolean;
  error?: string;
  language?: WaiverLanguage;
};

type Point = { x: number; y: number };

/**
 * Touch/mouse signature pad with no third-party dependency.
 * Uses native pointer listeners so touch and mouse both work, and so
 * touchmove can call preventDefault while the user is actively signing.
 */
export function SignaturePad({
  onSignatureChange,
  disabled = false,
  error,
  language = "en",
}: SignaturePadProps) {
  const t = waiverCopy(language);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const strokeCountRef = useRef(0);
  const [hasInk, setHasInk] = useState(false);
  const labelId = useId();
  const helpId = useId();
  const errorId = useId();

  const notify = useCallback(
    (present: boolean) => {
      onSignatureChange({
        present,
        contentType: present ? "image/png" : "",
      });
    },
    [onSignatureChange],
  );

  const notifyRef = useRef(notify);
  const disabledRef = useRef(disabled);

  useEffect(() => {
    notifyRef.current = notify;
  }, [notify]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = parent.clientWidth;
    const height = Math.max(180, Math.round(width * 0.45));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.5;
    strokeCountRef.current = 0;
    setHasInk(false);
    notifyRef.current(false);
  }, []);

  useEffect(() => {
    resizeCanvas();
    const onResize = () => resizeCanvas();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [resizeCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const toLocalPoint = (event: PointerEvent): Point => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };

    const markInk = () => {
      strokeCountRef.current += 1;
      setHasInk((prev) => {
        if (!prev) notifyRef.current(true);
        return true;
      });
    };

    const onPointerDown = (event: PointerEvent) => {
      if (disabledRef.current) return;
      event.preventDefault();
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      drawingRef.current = true;
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // ignore capture failures
      }
      const point = toLocalPoint(event);
      lastPointRef.current = point;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(point.x + 0.01, point.y + 0.01);
      ctx.stroke();
      markInk();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!drawingRef.current || disabledRef.current) return;
      event.preventDefault();
      const ctx = canvas.getContext("2d");
      const last = lastPointRef.current;
      if (!ctx || !last) return;
      const point = toLocalPoint(event);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      lastPointRef.current = point;
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      lastPointRef.current = null;
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    };

    const preventScroll = (event: TouchEvent) => {
      if (drawingRef.current) event.preventDefault();
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerUp);
    canvas.addEventListener("touchmove", preventScroll, { passive: false });

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerUp);
      canvas.removeEventListener("touchmove", preventScroll);
    };
  }, []);

  const clear = () => {
    resizeCanvas();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p id={labelId} className="text-base font-bold text-slate-950">
            {t.signature}
          </p>
          <p id={helpId} className="mt-1 text-sm leading-6 text-slate-600">
            {t.signHelp}
          </p>
        </div>
        <button
          type="button"
          onClick={clear}
          disabled={disabled || !hasInk}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t.clear}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border-2 border-slate-300 bg-white touch-none">
        <canvas
          ref={canvasRef}
          role="img"
          aria-labelledby={labelId}
          aria-describedby={error ? `${helpId} ${errorId}` : helpId}
          className="block w-full touch-none bg-white"
          style={{ touchAction: "none" }}
        />
      </div>

      {error ? (
        <p id={errorId} role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
