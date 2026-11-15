export function fmtT(t: number): string {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return "T+" + String(m).padStart(2, "0") + ":" + (s < 10 ? "0" : "") + s.toFixed(1);
}

export function fmtN(v: number | null | undefined, d = 0): string {
  if (v == null) return "sem dado";
  return v.toFixed(d).replace(".", ",");
}

export function fmtAge(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)} ms`;
  if (seconds < 60) return `${seconds.toFixed(1).replace(".", ",")} s`;
  return `${Math.floor(seconds / 60)} min`;
}

export function fmtClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds - m * 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
