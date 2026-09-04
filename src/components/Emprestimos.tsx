import { useEffect, useMemo, useRef, useState } from "react";
import { useRascunho } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { moeda, hojeISO } from "@/lib/finance";

const CHAVE = "emprestimos-v2";

type Modo = "dia" | "semana";

type Parcela = {
  n: number;
  vence: string; // YYYY-MM-DD
  valor: number;
  pago: boolean;
};

type Emprestimo = {
  id: string;
  pessoa: string;
  valor: number;
  juros: number;
  dias: number;
  modo: Modo;
  inicio: string;
  parcelas: Parcela[];
  criadoEm: number;
};

function calcular(valor: number, dias: number, jurosPct: number) {
  const total = valor * (1 + jurosPct / 100);
  const juros = total - valor;
  const d = Math.max(1, dias);
  const porDia = total / d;
  const semanas = Math.max(1, Math.ceil(d / 7));
  const porSemana = total / semanas;
  return { total, juros, porDia, semanas, porSemana };
}

function somaDias(iso: string, n: number) {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(a ?? 2026, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + n);
  return hojeISO(dt);
}

function gerarParcelas(
  valor: number,
  dias: number,
  modo: Modo,
  inicio: string,
  jurosPct: number,
): Parcela[] {
  const c = calcular(valor, dias, jurosPct);
  if (modo === "dia") {
    return Array.from({ length: Math.max(1, dias) }, (_, i) => ({
      n: i + 1,
      vence: somaDias(inicio, i + 1),
      valor: c.porDia,
      pago: false,
    }));
  }
  return Array.from({ length: c.semanas }, (_, i) => ({
    n: i + 1,
    vence: somaDias(inicio, (i + 1) * 7),
    valor: c.porSemana,
    pago: false,
  }));
}

function dataBR(iso: string) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

function textoResumo(valor: number, dias: number, jurosPct: number, pessoa?: string) {
  const c = calcular(valor, dias, jurosPct);
  return [
    "SIMULAÇÃO DE EMPRÉSTIMO",
    pessoa ? `Pessoa: ${pessoa}` : null,
    `Valor emprestado: ${moeda(valor)}`,
    `Juros: ${jurosPct}% (${moeda(c.juros)})`,
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
  const [pessoa, setPessoa] = useRascunho("emp:pessoa", "");
  const [valor, setValor] = useRascunho("emp:valor", "300");
  const [dias, setDias] = useRascunho("emp:dias", "20");
  const [jurosPct, setJurosPct] = useRascunho("emp:jurosPct", "40");
  const [modo, setModo] = useRascunho<Modo>("emp:modo", "dia");
  const [inicio, setInicio] = useRascunho("emp:inicio", hojeISO());
  const [aberto, setAberto] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hoje = hojeISO();

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
  const j = Number(jurosPct.replace(",", ".")) || 0;
  const c = useMemo(() => calcular(v, d, j), [v, d, j]);

  const lembretes = useMemo(() => {
    const hojeItens: { nome: string; valor: number }[] = [];
    const atrasados: { nome: string; valor: number; vence: string }[] = [];
    const quitados: string[] = [];
    lista.forEach((e) => {
      const nome = e.pessoa || "Sem nome";
      const todasPagas = e.parcelas.length > 0 && e.parcelas.every((p) => p.pago);
      if (todasPagas) quitados.push(nome);
      e.parcelas.forEach((p) => {
        if (p.pago) return;
        if (p.vence === hoje) hojeItens.push({ nome, valor: p.valor });
        else if (p.vence < hoje) atrasados.push({ nome, valor: p.valor, vence: p.vence });
      });
    });
    return { hojeItens, atrasados, quitados };
  }, [lista, hoje]);

  function salvar() {
    if (v <= 0 || d <= 0) {
      toast.error("Informe valor e prazo em dias.");
      return;
    }
    if (!pessoa.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    const novo: Emprestimo = {
      id: crypto.randomUUID(),
      pessoa: pessoa.trim(),
      valor: v,
      juros: j,
      dias: d,
      modo,
      inicio,
      parcelas: gerarParcelas(v, d, modo, inicio, j),
      criadoEm: Date.now(),
    };
    setLista((s) => [novo, ...s]);
    setAberto(novo.id);
    toast.success("Cliente e empréstimo registrados");
  }

  function alternarParcela(idEmp: string, n: number) {
    setLista((s) =>
      s.map((e) =>
        e.id !== idEmp
          ? e
          : {
              ...e,
              parcelas: e.parcelas.map((p) => (p.n === n ? { ...p, pago: !p.pago } : p)),
            },
      ),
    );
  }

  function marcarTudo(idEmp: string, pago: boolean) {
    setLista((s) =>
      s.map((e) =>
        e.id !== idEmp ? e : { ...e, parcelas: e.parcelas.map((p) => ({ ...p, pago })) },
      ),
    );
  }

  async function compartilharTexto() {
    const texto = textoResumo(v, d, j, pessoa.trim() || undefined);
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
    const blob = new Blob([textoResumo(v, d, j, pessoa.trim() || undefined)], {
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
    const linhas = textoResumo(v, d, j, pessoa.trim() || undefined).split("\n").slice(1);
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
      {pronto &&
        (lembretes.hojeItens.length > 0 ||
          lembretes.atrasados.length > 0 ||
          lembretes.quitados.length > 0) && (
          <Card className="border-warning/50 bg-warning/10">
            <CardHeader>
              <CardTitle className="text-base">Lembretes de hoje</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {lembretes.hojeItens.map((l, i) => (
                <p key={`h${i}`}>
                  Hoje é dia de receber <strong>{l.nome}</strong>: {moeda(l.valor)}
                </p>
              ))}
              {lembretes.atrasados.map((l, i) => (
                <p key={`a${i}`} className="text-destructive">
                  Atrasado: <strong>{l.nome}</strong> — {moeda(l.valor)} venceu em{" "}
                  {dataBR(l.vence)}
                </p>
              ))}
              {lembretes.quitados.map((n, i) => (
                <p key={`q${i}`} className="text-success">
                  {n} já pagou tudo. Empréstimo quitado!
                </p>
              ))}
            </CardContent>
          </Card>
        )}

      <Card>
        <CardHeader>
          <CardTitle>Novo empréstimo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="pessoa">Cliente</Label>
              <Input
                id="pessoa"
                value={pessoa}
                onChange={(e) => setPessoa(e.target.value)}
                placeholder="Nome do cliente"
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
            <div className="grid gap-2">
              <Label htmlFor="jurosEmp">Juros (%)</Label>
              <Input
                id="jurosEmp"
                inputMode="decimal"
                value={jurosPct}
                onChange={(e) => setJurosPct(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inicioEmp">Data do empréstimo</Label>
              <Input
                id="inicioEmp"
                type="date"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Cobrança</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={modo === "dia" ? "default" : "outline"}
                  onClick={() => setModo("dia")}
                >
                  Por dia
                </Button>
                <Button
                  type="button"
                  variant={modo === "semana" ? "default" : "outline"}
                  onClick={() => setModo("semana")}
                >
                  Por semana
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border bg-muted/40 p-4 sm:grid-cols-2">
            <Item rotulo={`Juros (${j}%)`} valor={moeda(c.juros)} />
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
          <CardTitle>Clientes e pagamentos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!pronto ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : lista.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum cliente cadastrado ainda.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Emprestado</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead>Falta</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((e) => {
                    const total = e.parcelas.reduce((s, p) => s + p.valor, 0);
                    const pago = e.parcelas
                      .filter((p) => p.pago)
                      .reduce((s, p) => s + p.valor, 0);
                    const quitado = pago >= total - 0.01;
                    const atrasado = e.parcelas.some((p) => !p.pago && p.vence < hoje);
                    const hojeVence = e.parcelas.some((p) => !p.pago && p.vence === hoje);
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">
                          {e.pessoa || "Sem nome"}
                          <span className="block text-xs text-muted-foreground">
                            {e.dias} dias · {e.modo === "dia" ? "diário" : "semanal"} ·{" "}
                            {e.juros ?? 40}% juros
                          </span>
                        </TableCell>
                        <TableCell>{moeda(e.valor)}</TableCell>
                        <TableCell>{moeda(total)}</TableCell>
                        <TableCell className="text-success">{moeda(pago)}</TableCell>
                        <TableCell>{moeda(Math.max(0, total - pago))}</TableCell>
                        <TableCell>
                          {quitado ? (
                            <Badge className="bg-success text-success-foreground">
                              Pago
                            </Badge>
                          ) : atrasado ? (
                            <Badge variant="destructive">Atrasado</Badge>
                          ) : hojeVence ? (
                            <Badge variant="secondary">Vence hoje</Badge>
                          ) : (
                            <Badge variant="outline">Em dia</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setAberto(aberto === e.id ? null : e.id)}
                          >
                            {aberto === e.id ? "Fechar" : "Check-list"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setLista((s) => s.filter((x) => x.id !== e.id))
                            }
                          >
                            Excluir
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {lista
                .filter((e) => e.id === aberto)
                .map((e) => (
                  <div key={e.id} className="grid gap-3 rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold">
                        Check-list de {e.pessoa || "Sem nome"}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => marcarTudo(e.id, true)}
                        >
                          Marcar tudo pago
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => marcarTudo(e.id, false)}
                        >
                          Limpar
                        </Button>
                      </div>
                    </div>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {e.parcelas.map((p) => (
                        <li
                          key={p.n}
                          className="flex items-center gap-3 rounded-md border p-2"
                        >
                          <Checkbox
                            id={`${e.id}-${p.n}`}
                            checked={p.pago}
                            onCheckedChange={() => alternarParcela(e.id, p.n)}
                          />
                          <Label
                            htmlFor={`${e.id}-${p.n}`}
                            className="flex-1 cursor-pointer text-sm font-normal"
                          >
                            {e.modo === "dia" ? "Dia" : "Semana"} {p.n} ·{" "}
                            {dataBR(p.vence)} · {moeda(p.valor)}
                          </Label>
                          {p.pago ? (
                            <span className="text-xs text-success">pago</span>
                          ) : p.vence === hoje ? (
                            <span className="text-xs font-medium">hoje</span>
                          ) : p.vence < hoje ? (
                            <span className="text-xs text-destructive">atrasado</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </>
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
