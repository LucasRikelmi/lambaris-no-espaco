import { Info, ShieldAlert, Volume2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSimEngine, useSimVersion } from "@/lib/sim/store";
import { useNarrator } from "@/lib/narration";

export function AiNotice({ compact = false }: { compact?: boolean }) {
  useSimVersion();
  const engine = useSimEngine();
  const down = engine.aiStatus === "down" || !engine.aiEnabled;
  if (!down) return null;

  const reason = engine.aiCrashed
    ? "O processo do modelo local parou de responder (watchdog)."
    : engine.aiEnabled
      ? "O modelo local está sem heartbeat no momento."
      : "A IA local foi desligada na simulação.";

  return (
    <Alert variant="info">
      <ShieldAlert />
      <AlertTitle>IA local indisponível — o caminho crítico não depende dela</AlertTitle>
      <AlertDescription>
        {reason} O alarme visual e sonoro, o registro do evento e a camada 3 estática continuam funcionando.
        {compact ? null : " Você pode abrir o evento, consultar as evidências e salvar a revisão normalmente."}
      </AlertDescription>
    </Alert>
  );
}

export function VoiceNotice() {
  const narration = useNarrator();
  if (narration.state === "browser") {
    return (
      <Alert variant="warn">
        <Volume2 />
        <AlertTitle>Voice Studio indisponível</AlertTitle>
        <AlertDescription>{narration.message} A narração segue pela voz do navegador.</AlertDescription>
      </Alert>
    );
  }
  if (narration.state === "error") {
    return (
      <Alert variant="warn">
        <Volume2 />
        <AlertTitle>Sem voz disponível</AlertTitle>
        <AlertDescription>{narration.message} Leia a resposta na conversa e siga por texto.</AlertDescription>
      </Alert>
    );
  }
  if (narration.state === "loading" || narration.state === "playing" || narration.state === "paused") {
    return (
      <Alert>
        <Info />
        <AlertTitle>Narração em andamento</AlertTitle>
        <AlertDescription>{narration.message}</AlertDescription>
      </Alert>
    );
  }
  return null;
}
