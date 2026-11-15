import { useEffect, useRef } from "react";
import { cssHsl } from "@/lib/utils";
import { useSimEngine } from "@/lib/sim/store";
import type { SignalKey } from "@/lib/sim/scenarios";
import { SIGNALS } from "@/lib/sim/signals";

function fit(cv: HTMLCanvasElement) {
  const rect = cv.getBoundingClientRect();
  const d = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(rect.width * d));
  const h = Math.max(1, Math.round(rect.height * d));
  if (cv.width !== w || cv.height !== h) {
    cv.width = w;
    cv.height = h;
  }
  return { w, h, d };
}

function drawBuffer(
  cv: HTMLCanvasElement,
  buf: Float32Array,
  wi: number,
  color: string,
  lo: number,
  hi: number
) {
  const { w, h, d } = fit(cv);
  const c = cv.getContext("2d");
  if (!c) return;
  c.clearRect(0, 0, w, h);
  c.strokeStyle = cssHsl("--border");
  c.lineWidth = 1;
  c.beginPath();
  for (let i = 1; i < 6; i++) {
    const x = Math.round((w * i) / 6) + 0.5;
    c.moveTo(x, 0);
    c.lineTo(x, h);
  }
  c.stroke();
  const N = buf.length;
  c.strokeStyle = color;
  c.lineWidth = 1.6 * d;
  c.beginPath();
  for (let i = 0; i < N; i++) {
    const value = buf[(wi + i) % N];
    const x = (i / (N - 1)) * w;
    const y = h - ((value - lo) / (hi - lo)) * h;
    if (i) c.lineTo(x, y);
    else c.moveTo(x, y);
  }
  c.stroke();
}

export function WaveCanvas({ kind }: { kind: "ecg" | "ppg" }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const engine = useSimEngine();

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const cv = ref.current;
      if (cv) {
        const v = engine.v;
        const color =
          kind === "ecg"
            ? v?.leadOff
              ? cssHsl("--muted-foreground")
              : v && v.rhythm !== "sinus"
                ? cssHsl("--crit")
                : cssHsl("--ok")
            : v && !v.ppgOk
              ? cssHsl("--crit")
              : cssHsl("--info");
        const buf = kind === "ecg" ? engine.ecg : engine.ppg;
        drawBuffer(cv, buf, engine.wi, color, kind === "ecg" ? -0.5 : -0.15, kind === "ecg" ? 1.2 : 1.25);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine, kind]);

  return <canvas ref={ref} className="block w-full" style={{ height: 84 }} aria-hidden />;
}

export function Sparkline({ signal }: { signal: SignalKey }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const engine = useSimEngine();
  const meta = SIGNALS[signal];

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const { w, h, d } = fit(cv);
    const c = cv.getContext("2d");
    if (!c) return;
    c.clearRect(0, 0, w, h);
    const y = (v: number) => h - 2 * d - ((v - meta.lo) / (meta.hi - meta.lo)) * (h - 4 * d);
    c.setLineDash([3 * d, 3 * d]);
    c.strokeStyle = cssHsl("--warn");
    c.globalAlpha = 0.55;
    c.lineWidth = 1 * d;
    meta.thresholds.forEach((th) => {
      c.beginPath();
      c.moveTo(0, y(th));
      c.lineTo(w, y(th));
      c.stroke();
    });
    c.setLineDash([]);
    c.globalAlpha = 1;
    const tEnd = engine.t;
    const t0 = tEnd - 60;
    c.strokeStyle = cssHsl("--ok");
    c.lineWidth = 1.4 * d;
    c.beginPath();
    let pen = false;
    for (const point of engine.hist) {
      if (point.t < t0) continue;
      const value = point[signal as keyof typeof point];
      const x = ((point.t - t0) / 60) * w;
      if (value == null || typeof value !== "number") {
        pen = false;
        continue;
      }
      const yy = y(Math.max(meta.lo, Math.min(meta.hi, value)));
      if (pen) c.lineTo(x, yy);
      else c.moveTo(x, yy);
      pen = true;
    }
    c.stroke();
  });

  return <canvas ref={ref} className="mt-1 block w-full" style={{ height: 30 }} aria-hidden />;
}
