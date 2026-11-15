import { createContext, useContext } from "react";
import type { View } from "./nav";

export interface NavContextValue {
  view: View;
  setView: (view: View) => void;
  openEvent: (id: string) => void;
  mobileEventDetail: boolean;
  setMobileEventDetail: (open: boolean) => void;
}

export const NavContext = createContext<NavContextValue | null>(null);

export function useNav(): NavContextValue {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNav deve ser usado dentro do AppShell");
  return ctx;
}
