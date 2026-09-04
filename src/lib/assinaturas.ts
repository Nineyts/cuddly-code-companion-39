export type Status = "ATIVO" | "PROXIMO" | "EXPIRADO" | "SUSPENSO";

export function diasRestantes(vencimento: string): number {
  const hoje = new Date();
  const base = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const [a, m, d] = vencimento.split("-").map(Number);
  const alvo = Date.UTC(a ?? 1970, (m ?? 1) - 1, d ?? 1);
  return Math.round((alvo - base) / 86400000);
}

export function calcularStatus(
  status: string,
  suspensoManual: boolean,
  vencimento: string,
): Status {
  if (suspensoManual || status === "suspenso") return "SUSPENSO";
  const dias = diasRestantes(vencimento);
  if (dias < 0) return "EXPIRADO";
  if (dias <= 5) return "PROXIMO";
  return "ATIVO";
}

export const rotuloStatus: Record<Status, string> = {
  ATIVO: "Ativo",
  PROXIMO: "Próximo do vencimento",
  EXPIRADO: "Expirado",
  SUSPENSO: "Suspenso",
};

export function classeStatus(status: Status): string {
  switch (status) {
    case "ATIVO":
      return "border-success/40 bg-success/15 text-success";
    case "PROXIMO":
      return "border-warning/40 bg-warning/15 text-warning-foreground";
    case "EXPIRADO":
      return "border-destructive/40 bg-destructive/15 text-destructive";
    default:
      return "border-muted-foreground/30 bg-muted text-muted-foreground";
  }
}

export function moeda(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function dataBR(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function contagem(vencimento: string): string {
  const dias = diasRestantes(vencimento);
  if (dias === 0) return "vence hoje";
  if (dias > 0) return `faltam ${dias} dia${dias === 1 ? "" : "s"}`;
  const atraso = Math.abs(dias);
  return `vencido há ${atraso} dia${atraso === 1 ? "" : "s"}`;
}

export function slugificar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
