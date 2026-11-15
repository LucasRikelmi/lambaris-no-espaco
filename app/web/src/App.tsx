import { TooltipProvider } from "@/components/ui/tooltip";
import { SimProvider } from "@/lib/sim/store";
import { AppShell } from "@/components/shell/AppShell";

export function App() {
  return (
    <SimProvider>
      <TooltipProvider delayDuration={200}>
        <AppShell />
      </TooltipProvider>
    </SimProvider>
  );
}
