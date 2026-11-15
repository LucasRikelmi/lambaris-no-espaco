import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const cssCache = new Map<string, string>();

export function cssHsl(name: string, alpha?: number): string {
  let raw = cssCache.get(name);
  if (raw === undefined) {
    raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    cssCache.set(name, raw);
  }
  return alpha != null ? `hsl(${raw} / ${alpha})` : `hsl(${raw})`;
}
