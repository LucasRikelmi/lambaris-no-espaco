import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlarmBanner } from "./AlarmBanner";
import { HeaderBar } from "./HeaderBar";
import { MobileNav } from "./MobileNav";
import { Sidebar } from "./Sidebar";
import { NavContext, type NavContextValue } from "./nav-context";
import type { View } from "./nav";
import { useSimEngine } from "@/lib/sim/store";
import { SimulationScreen } from "@/screens/SimulationScreen";
import { EventsScreen } from "@/screens/EventsScreen";
import { AssistantScreen } from "@/screens/AssistantScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";

export function AppShell() {
  const engine = useSimEngine();
  const [view, setView] = useState<View>("simulacao");
  const [mobileEventDetail, setMobileEventDetail] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const openEvent = useCallback(
    (id: string) => {
      engine.selectEvent(id);
      setView("eventos");
      setMobileEventDetail(true);
    },
    [engine]
  );

  const navValue = useMemo<NavContextValue>(
    () => ({ view, setView, openEvent, mobileEventDetail, setMobileEventDetail }),
    [view, openEvent, mobileEventDetail]
  );

  useEffect(() => {
    mainRef.current?.focus();
  }, [view]);

  return (
    <NavContext.Provider value={navValue}>
      <div className="flex min-h-screen flex-col md:flex-row">
        <Sidebar view={view} onChange={setView} />
        <div className="flex min-w-0 flex-1 flex-col">
          <HeaderBar view={view} />
          <AlarmBanner />
          <main
            ref={mainRef}
            tabIndex={-1}
            className="flex-1 px-4 py-4 outline-none md:px-6 md:py-6"
          >
            {view === "simulacao" && <SimulationScreen />}
            {view === "eventos" && (
              <EventsScreen
                mobileDetail={mobileEventDetail}
                onOpenDetail={() => setMobileEventDetail(true)}
                onBackToList={() => setMobileEventDetail(false)}
              />
            )}
            {view === "assistente" && <AssistantScreen />}
            {view === "configuracoes" && <SettingsScreen />}
          </main>
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-[11px] text-muted-foreground md:px-6">
            <span>PROTÓTIPO · Valores simulados · Apoio à decisão, sem diagnóstico automático</span>
            <span>Lambaris no Espaço · NASA Space Apps 2026</span>
          </footer>
          <MobileNav view={view} onChange={setView} />
        </div>
      </div>
    </NavContext.Provider>
  );
}
