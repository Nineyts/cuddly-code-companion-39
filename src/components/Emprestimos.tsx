import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { moeda } from "@/lib/finance";

const JUROS = 0.4;
const CHAVE = "emprestimos-v1";

type Emprestimo = {
  id: string;
  pessoa: string;
  valor: number;
  dias: number;
  criadoEm: number;
};

function calcular(valor: number, dias: number) {
  const total = valor * (1 + JUROS);
  const juros = total - valor;
  const d = Math.max(1, dias);
  const porDia = total / d;
  const semanas = Math.max(1, Math.ceil(d / 7));
  const porSemana = total / semanas;
  return { total, juros, porDia, semanas, porSemana };
}

function textoResumo(valor: number, dias: number, pessoa?: string) {
  const c = calcular(valor, dias);
  return [
    "SIMULAÇÃO DE EMPRÉSTIMO",
    pessoa ? `Pessoa: ${pessoa}` : null,
    `Valor emprestado: ${moeda(valor)}`,
    `Juros: 40% (${moeda(c.juros)})`,
    `Total a pagar: ${moeda(c.total)}`,
    `Prazo: ${dias} dias`,
    `Pagamento por dia: ${moeda(c.porDia)}`,
    `Pagamento por semana: ${moeda(c.porSemana)} (${c.semanas} semanas)`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function Emprestimos() {
  const [lista, setLista] = useState<Emprestimo[]>([]);
  const [pronto, setPronto] = useState(false);
  const [pessoa, setPessoa] = useState("");
  const [valor, setValor] = useState("300");
  const [dias, setDias] = useState("20");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    try {
      const bruto = localStorage.getItem(CHAVE);
      if (bruto) setLista(JSON.parse(bruto) as Emprestimo[]);
    } catch {
      /* ignora */
    }
    setPronto(true);
  }, []);

  useEffect(() => {
    if (!pronto) return;
    localStorage.setItem(CHAVE, JSON.stringify(lista));
  }, [lista, pronto]);

  const v = Number(valor.replace(",", ".")) || 0;
  const d = Number(dias) || 0;
  const c = useMemo(() => calcular(v, d), [v, d]);

  function salvar() {
    if (v <= 0 || d <= 0) {
      toast.error("Informe valor e prazo em dias.");
      return;
    }
    setLista((s) => [
      { id: crypto.randomUUID(), pessoa: pessoa.trim(), valor: v, dias: d, criadoEm: Date.now() },
      ...s,
    ]);
    toast.success("Empréstimo registrado");
  }

  async function compartilharTexto() {
    const texto = textoResumo(v, d, pessoa.trim() || undefined);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Simulação de empréstimo", text: texto });
        return;
      }
      await navigator.clipboard.writeText(texto);
      toast.success("Resumo copiado! Agora só colar onde quiser.");
    } catch {
      toast.error("Não foi possível compartilhar agora.");
    }
  }

  function baixarTexto() {
    const blob = new Blob([textoResumo(v, d, pessoa.trim() || undefined)], {
      type: "text/plain;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "simulacao-emprestimo.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function baixarImagem() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = 900;
    const H = 620;
    canvas.width = W;
    canvas.height = H;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 40px system-ui, sans-serif";
    ctx.fillText("Simulação de Empréstimo", 50, 90);
    ctx.fillStyle = "#facc15";
    ctx.fillRect(50, 110, 200, 6);
    ctx.font = "26px system-ui, sans-serif";
    const linhas = textoResumo(v, d, pessoa.trim() || undefined).split("\n").slice(1);
    linhas.forEach((linha, i) => {
      ctx.fillStyle = i === linhas.length - 3 ? "#4ade80" : "#e2e8f0";
      ctx.fillText(linha, 50, 190 + i * 52);
    });
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "simulacao-emprestimo.png";
    a.click();
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Simulador de empréstimo (juros de 40%)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="pessoa">Para quem (opcional)</Label>
              <Input
                id="pessoa"
                value={pessoa}
                onChange={(e) => setPessoa(e.target.value)}
                placeholder="Nome"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="valorEmp">Valor emprestado (R$)</Label>
              <Input
                id="valorEmp"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="diasEmp">Prazo (dias)</Label>
              <Input
                id="diasEmp"
                inputMode="numeric"
                value={dias}
                onChange={(e) => setDias(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border bg-muted/40 p-4 sm:grid-cols-2">
            <Item rotulo="Juros (40%)" valor={moeda(c.juros)} />
            <Item rotulo="Total a pagar" valor={moeda(c.total)} destaque />
            <Item rotulo="Pagamento por dia" valor={moeda(c.porDia)} destaque />
            <Item
              rotulo={`Pagamento por semana (${c.semanas})`}
              valor={moeda(c.porSemana)}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={salvar}>Registrar empréstimo</Button>
            <Button variant="outline" onClick={compartilharTexto}>
              Compartilhar texto
            </Button>
            <Button variant="outline" onClick={baixarTexto}>
              Baixar .txt
            </Button>
            <Button variant="outline" onClick={baixarImagem}>
              Baixar imagem
            </Button>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Empréstimos registrados</CardTitle>
        </CardHeader>
        <CardContent>
          {!pronto ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : lista.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum empréstimo registrado ainda.
            </p>
          ) : (
            <ul className="divide-y">
              {lista.map((e) => {
                const r = calcular(e.valor, e.dias);
                return (
                  <li key={e.id} className="grid gap-1 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{e.pessoa || "Sem nome"}</span>
                      <span className="font-semibold">{moeda(r.total)}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setLista((s) => s.filter((x) => x.id !== e.id))}
                        aria-label="Excluir empréstimo"
                      >
                        Excluir
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {moeda(e.valor)} em {e.dias} dias · {moeda(r.porDia)}/dia ·{" "}
                      {moeda(r.porSemana)}/semana
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Item({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{rotulo}</span>
      <span className={destaque ? "text-lg font-bold" : "font-medium"}>{valor}</span>
    </div>
  );
}
