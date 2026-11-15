import { FlowGuide } from "@/components/sim/FlowGuide";
import { ScenarioSection } from "@/components/sim/ScenarioSection";
import { ControlBar } from "@/components/sim/ControlBar";
import { PanicButton } from "@/components/sim/PanicButton";
import { PromptCard, ActiveEventCard } from "@/components/sim/AlarmZone";
import { SignalsPanel } from "@/components/sim/SignalsPanel";
import { RulesPanel } from "@/components/sim/RulesPanel";
import { DetailsSection } from "@/components/sim/DetailsSection";
import { AiNotice } from "@/components/common/notices";

export function SimulationScreen() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <FlowGuide />
      <ScenarioSection />
      <ControlBar />
      <PanicButton />
      <AiNotice compact />
      <PromptCard />
      <ActiveEventCard />
      <SignalsPanel />
      <RulesPanel />
      <DetailsSection />
    </div>
  );
}
