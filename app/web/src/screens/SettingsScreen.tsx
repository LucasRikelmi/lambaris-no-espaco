import { useCallback, useEffect, useState } from "react";
import { BookText, Cpu, Database, ExternalLink, Info, Megaphone, RefreshCw, Server, Volume2, VolumeX } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { fetchStatus, type ServiceState, type ServiceStatus } from "@/lib/api";
import { SOURCES } from "@/lib/sim/engine";
import { useSimEngine, useSimVersion } from "@/lib/sim/store";

const GUIDANCE: Record<"ollama" | "qdrant" | "voz", { icon: typeof Server; title: string; fix: string }> = {
  ollama: {
    icon: Cpu,
    title: "Ollama (Gemma 3 4B e MedGemma 4B)",
    fix: "Suba o serviço \"ollama\" pelo Docker Compose: na primeira execução ele baixa GEMMA_MODEL, MEDGEMMA_MODEL e EMBED_MODEL e serve a API em 11434. Fora do Docker, rode \"ollama serve\" e use LM_URL=http://127.0.0.1:11434/v1."
  },
  qdrant: {
    icon: Database,
    title: "Qdrant (busca de procedimentos)",
    fix: "Suba o serviço pelo Docker Compose (docker compose up). Na primeira busca, o servidor indexa procedimentos.json automaticamente no Qdrant."
  },
  voz: {
    icon: Volume2,
    title: "Voice Studio (narração)",
    fix: "Preencha TTS_URL, TTS_MODEL, TTS_VOICE e, se exigido, TTS_TOKEN no .env. Sem provedor configurado, a interface usa a voz do navegador quando existir."
  }
};

function ServiceRow({ id, state }: { id: "ollama" | "qdrant" | "voz"; state: ServiceState }) {
  const { icon: Icon, title, fix } = GUIDANCE[id];
  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Icon className={cn("size-4", state.ok ? "text-ok" : "text-crit")} aria-hidden />
        <p className="text-sm font-semibold">{title}</p>
        <Badge variant={state.ok ? "ok" : "crit"} className="ml-auto">
          {state.ok ? "Disponível" : "Indisponível"}
        </Badge>
      </div>
      <p className={cn("mt-1 text-[11px]", state.ok ? "text-muted-foreground" : "text-crit")}>{state.detail}</p>
      {!state.ok ? <p className="mt-1.5 text-[11px] text-muted-foreground">{fix}</p> : null}
    </div>
  );
}

export function SettingsScreen() {
  useSimVersion();
  const engine = useSimEngine();
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await fetchStatus();
    setStatus(next);
    setCheckedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Preferências</CardTitle>
          <CardDescription>Som do alarme, voz do alarme e voz do assistente são ajustes independentes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/20 p-3">
            {engine.soundAlarm ? (
              <Volume2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            ) : (
              <VolumeX className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="alarm-sound" className="cursor-pointer text-xs">
                  Som do alarme
                </Label>
                <Switch id="alarm-sound" checked={engine.soundAlarm} onCheckedChange={(v) => engine.setSoundAlarm(v)} />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Bipes locais no navegador quando há alarme crítico. O navegador só libera o áudio depois do primeiro
                toque na tela. O alarme visual continua mesmo com o som desligado.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/20 p-3">
            <Volume2 className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="voice-read" className="cursor-pointer text-xs">
                  Voz do assistente
                </Label>
                <Switch id="voice-read" checked={engine.autoRead} onCheckedChange={(v) => engine.setAutoRead(v)} />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Lê a resposta completa do assistente em voz alta pelo endpoint do Voice Studio. Sem Voice Studio, usa a
                voz do navegador. Um alarme novo interrompe a narração para dar prioridade ao aviso.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/20 p-3">
            <Megaphone
              className={cn("mt-0.5 size-4 shrink-0", engine.speakAlarm ? "text-primary" : "text-muted-foreground")}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="speak-alarm" className="cursor-pointer text-xs">
                  Voz do alarme
                </Label>
                <Switch id="speak-alarm" checked={engine.speakAlarm} onCheckedChange={(v) => engine.setSpeakAlarm(v)} />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Fala o nome, a causa e o alcance do alarme crítico assim que ele dispara, pelo Voice Studio (ou voz do
                navegador). É independente dos bipes de “Som do alarme”. Silenciar o aviso interrompe a fala.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Serviços</CardTitle>
              <CardDescription>
                Estado das integrações locais. A simulação e o alarme funcionam mesmo com tudo indisponível.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Verificar de novo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {status ? (
            <>
              <ServiceRow id="ollama" state={status.ollama} />
              <ServiceRow id="qdrant" state={status.qdrant} />
              <ServiceRow id="voz" state={status.voz} />
              <p className="text-[11px] text-muted-foreground">
                Provedor de modelos: {status.provider || "não informado"}.
                {checkedAt ? ` Última verificação às ${checkedAt.toLocaleTimeString("pt-BR")}.` : ""}
              </p>
            </>
          ) : (
            <Alert variant="warn">
              <Server />
              <AlertTitle>Servidor local não respondeu</AlertTitle>
              <AlertDescription>
                Sem o servidor, o assistente, a busca de procedimentos e a narração ficam indisponíveis. O alarme e o
                registro do evento seguem funcionando no navegador. Rode <code>python server.py</code> ou{" "}
                <code>docker compose up</code>.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Configuração e credenciais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-[12px] text-muted-foreground">
          <Alert>
            <Info />
            <AlertTitle>Credenciais ficam no servidor</AlertTitle>
            <AlertDescription>
              Tokens e endereços não vão para o navegador: o servidor lê tudo de variáveis de ambiente do Docker Compose.
            </AlertDescription>
          </Alert>
          <Separator />
          <p>
            Ajuste o arquivo <code>.env</code> a partir do <code>.env.example</code> e suba com{" "}
            <code>docker compose up</code>. O Compose mantém os serviços <code>simulador</code>, <code>ollama</code> e{" "}
            <code>qdrant</code> juntos, com o volume de procedimentos e dos modelos preservado.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <code>LM_URL</code>, <code>GEMMA_MODEL</code>, <code>MEDGEMMA_MODEL</code>, <code>EMBED_MODEL</code> —
              Ollama.
            </li>
            <li>
              <code>TTS_URL</code>, <code>TTS_MODEL</code>, <code>TTS_VOICE</code>, <code>TTS_TOKEN</code> — Voice
              Studio.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <BookText className="size-4 text-muted-foreground" aria-hidden /> Fontes dos dados
          </CardTitle>
          <CardDescription>
            De onde vêm os limiares usados pelas regras. Os códigos MED-*, AMB-* e TEC-* são fictícios da missão.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {SOURCES.map((src) => (
            <a
              key={src.key}
              href={src.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-start gap-2 rounded-lg border border-border bg-secondary/20 p-3 transition-colors hover:border-primary/50"
            >
              <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0">
                <span className="block text-[12px] font-semibold text-primary">
                  {src.key} — {src.title}
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">{src.note}</span>
              </span>
            </a>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
