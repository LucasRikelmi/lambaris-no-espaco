import { Cpu, Megaphone, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { LOC, type LocationId } from "@/lib/sim/scenarios";
import { useSimEngine, useSimVersion } from "@/lib/sim/store";

const SPEEDS = [1, 2, 4];

export function ControlBar() {
  useSimVersion();
  const engine = useSimEngine();

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={engine.running ? "secondary" : "default"} onClick={() => engine.toggleRunning()}>
            {engine.running ? <Pause className="size-4" /> : <Play className="size-4" />}
            {engine.running ? "Pausar" : "Iniciar"}
          </Button>
          <Button variant="outline" onClick={() => engine.setScenario(engine.scen)}>
            <RotateCcw className="size-4" /> Reiniciar
          </Button>

          <div className="flex items-center gap-2 rounded-md border border-border px-2 py-1">
            <Label htmlFor="speed" className="text-[10px]">
              Velocidade
            </Label>
            <div role="group" aria-label="Velocidade da simulação" className="flex overflow-hidden rounded-md border border-border">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={engine.speed === s}
                  onClick={() => engine.setSpeed(s)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-semibold transition-colors",
                    engine.speed === s ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select value={engine.loc} onValueChange={(v) => engine.setLocation(v as LocationId)}>
              <SelectTrigger className="h-8 w-[132px]" aria-label="Local da missão">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(LOC) as LocationId[]).map((id) => (
                  <SelectItem key={id} value={id}>
                    {LOC[id].name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
            {engine.soundAlarm ? <Volume2 className="size-4 text-primary" /> : <VolumeX className="size-4 text-muted-foreground" />}
            <Label htmlFor="sound" className="cursor-pointer text-[10px]">
              Som do alarme
            </Label>
            <Switch id="sound" checked={engine.soundAlarm} onCheckedChange={(v) => engine.setSoundAlarm(v)} />
          </div>

          <div className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
            <Megaphone className={engine.speakAlarm ? "size-4 text-primary" : "size-4 text-muted-foreground"} />
            <Label htmlFor="speak-alarm" className="cursor-pointer text-[10px]">
              Voz do alarme
            </Label>
            <Switch id="speak-alarm" checked={engine.speakAlarm} onCheckedChange={(v) => engine.setSpeakAlarm(v)} />
          </div>

          <div className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
            <Cpu className="size-4 text-info" />
            <Label htmlFor="ai" className="cursor-pointer text-[10px]">
              IA local
            </Label>
            <Switch id="ai" checked={engine.aiEnabled} onCheckedChange={() => engine.toggleAi()} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
