import { createContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { SimEngine, engine } from "./engine";

const SimContext = createContext<SimEngine>(engine);

export function SimProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const real = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (engine.running) engine.advance(real);
      engine.uiTick(now);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame((t) => {
      last = t;
      frame(t);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return <SimContext.Provider value={engine}>{children}</SimContext.Provider>;
}

export function useSimEngine(): SimEngine {
  return engine;
}

/** Re-renderiza o componente a cada atualização do motor (≈8 fps). */
export function useSimVersion(): number {
  return useSyncExternalStore(engine.subscribe, engine.getVersion, engine.getVersion);
}
