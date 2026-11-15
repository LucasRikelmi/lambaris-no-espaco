import { Activity, MessagesSquare, Siren, SlidersHorizontal, type LucideIcon } from "lucide-react";

export type View = "simulacao" | "eventos" | "assistente" | "configuracoes";

export interface NavItem {
  id: View;
  label: string;
  icon: LucideIcon;
  hint: string;
}

export const NAV: NavItem[] = [
  { id: "simulacao", label: "Simulação", icon: Activity, hint: "Executar e monitorar sinais" },
  { id: "eventos", label: "Eventos", icon: Siren, hint: "Investigar e registrar" },
  { id: "assistente", label: "Assistente", icon: MessagesSquare, hint: "Conversar e consultar procedimentos" },
  { id: "configuracoes", label: "Configurações", icon: SlidersHorizontal, hint: "Ajustar e diagnosticar serviços" }
];
