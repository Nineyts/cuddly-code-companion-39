import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  hojeISO,
  inicioDaSemanaISO,
  moeda,
  motivacaoDoDia,
  resumo,
  useFinancas,
  type Tipo,
} from "@/lib/finance";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Meu Controle Financeiro — gastos, metas e relatório do dia" },
      {
        name: "description",
        content:
          "Registre entradas e gastos do dia a dia, acompanhe metas diárias e semanais, avance na sua meta de conquista e receba uma motivação por dia.",
      },
      {
        property: "og:title",
        content: "Meu Controle Financeiro — gastos, metas e relatório do dia",
      },
      {
        property: "og:description",
        content:
          "Controle simples de entradas e gastos com metas diárias, semanais e motivação para não desistir.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { estado, pronto, adicionar, remover, salvarMetas, guardar } = useFinancas();
  const hoje = hojeISO();
  const semana = inicioDaSemanaISO();

  const [tipo, setTipo] = useState<Tipo>("gasto");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hoje);
  const [aporte, setAporte] = useState("");

  const dia = useMemo(
    () => resumo(estado.lancamentos, (l) => l.data === hoje),
    [estado.lancamentos, hoje],
  );
  const semanal = useMemo(
    () => resumo(estado.lancamentos, (l) => l.data >= semana && l.data <= hoje),
    [estado.lancamentos, semana, hoje],
  );

  const { metas } = estado;
  const pctDia = metas.gastoDiario > 0 ? (dia.gastos / metas.gastoDiario) * 100 : 0;
  const pctSemana =
    metas.gastoSemanal > 0 ? (semanal.gastos / metas.gastoSemanal) * 100 : 0;
  const pctSonho =
    metas.sonhoValor > 0 ? (metas.sonhoGuardado / metas.sonhoValor) * 100 : 0;

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const v = Number(valor.replace(",", "."));
    if (!descricao.trim() || !Number.isFinite(v) || v <= 0) {
      toast.error("Escreva uma descrição e um valor maior que zero.");
      return;
    }
    adicionar({ tipo, descricao: descricao.trim(), valor: v, data });
    setDescricao("");
    setValor("");
    toast.success(tipo === "gasto" ? "Gasto registrado" : "Entrada registrada");
  }

  return (
    <main className="min-h-screen bg-background pb-16">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Meu Controle Financeiro
          </h1>
          <p className="mt-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm font-medium text-foreground">
            💡 {motivacaoDoDia(hoje)}
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8">
        <section className="grid gap-4 sm:grid-cols-3">
          <Cartao titulo="Entradas de hoje" valor={moeda(dia.entradas)} tom="success" />
          <Cartao titulo="Gastos de hoje" valor={moeda(dia.gastos)} tom="destructive" />
          <Cartao
            titulo="Saldo do dia"
            valor={moeda(dia.saldo)}
            tom={dia.saldo >= 0 ? "success" : "destructive"}
          />
        </section>

        <Tabs defaultValue="registrar">
          <TabsList>
            <TabsTrigger value="registrar">Registrar</TabsTrigger>
            <TabsTrigger value="relatorio">Relatório do dia</TabsTrigger>
            <TabsTrigger value="metas">Metas</TabsTrigger>
          </TabsList>

          <TabsContent value="registrar" className="mt-4 grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Novo lançamento</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={enviar} className="grid gap-4">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={tipo === "gasto" ? "default" : "outline"}
                      onClick={() => setTipo("gasto")}
                    >
                      Gasto
                    </Button>
                    <Button
                      type="button"
                      variant={tipo === "entrada" ? "default" : "outline"}
                      onClick={() => setTipo("entrada")}
                    >
                      Entrada
                    </Button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="grid gap-2 sm:col-span-1">
                      <Label htmlFor="descricao">Descrição</Label>
                      <Input
                        id="descricao"
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        placeholder="Almoço, salário, mercado..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="valor">Valor (R$)</Label>
                      <Input
                        id="valor"
                        inputMode="decimal"
                        value={valor}
                        onChange={(e) => setValor(e.target.value)}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="data">Data</Label>
                      <Input
                        id="data"
                        type="date"
                        value={data}
                        onChange={(e) => setData(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button type="submit" className="justify-self-start">
                    Adicionar
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lançamentos de hoje</CardTitle>
              </CardHeader>
              <CardContent>
                {!pronto ? (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                ) : dia.itens.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nada registrado ainda hoje. Comece pelo primeiro gasto ou entrada.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {dia.itens.map((l) => (
                      <li key={l.id} className="flex items-center gap-3 py-3">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            l.tipo === "entrada" ? "bg-success" : "bg-destructive"
                          }`}
                        />
                        <span className="flex-1 truncate">{l.descricao}</span>
                        <span
                          className={`font-semibold ${
                            l.tipo === "entrada" ? "text-success" : "text-destructive"
                          }`}
                        >
                          {l.tipo === "entrada" ? "+" : "−"}
                          {moeda(l.valor)}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => remover(l.id)}
                          aria-label={`Excluir ${l.descricao}`}
                        >
                          Excluir
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="relatorio" className="mt-4 grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Fechamento do dia</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Linha rotulo="Entradas" valor={moeda(dia.entradas)} />
                <Linha rotulo="Gastos" valor={moeda(dia.gastos)} />
                <Linha rotulo="Saldo" valor={moeda(dia.saldo)} destaque />
                <Linha rotulo="Lançamentos" valor={String(dia.itens.length)} />
                <Linha
                  rotulo="Maior gasto"
                  valor={
                    dia.itens.filter((l) => l.tipo === "gasto").length
                      ? moeda(
                          Math.max(
                            ...dia.itens
                              .filter((l) => l.tipo === "gasto")
                              .map((l) => l.valor),
                          ),
                        )
                      : "—"
                  }
                />
                <p
                  className={`rounded-lg px-4 py-3 text-sm font-medium ${
                    dia.gastos <= metas.gastoDiario
                      ? "bg-success/15 text-foreground"
                      : "bg-destructive/15 text-foreground"
                  }`}
                >
                  {dia.gastos <= metas.gastoDiario
                    ? `Parabéns! Você ficou dentro da meta diária e sobraram ${moeda(
                        metas.gastoDiario - dia.gastos,
                      )}.`
                    : ""}
                  {dia.gastos > metas.gastoDiario
                    ? `Você passou ${moeda(
                        dia.gastos - metas.gastoDiario,
                      )} da meta diária. Amanhã é uma nova chance.`
                    : ""}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resumo da semana</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Linha rotulo="Entradas" valor={moeda(semanal.entradas)} />
                <Linha rotulo="Gastos" valor={moeda(semanal.gastos)} />
                <Linha rotulo="Saldo" valor={moeda(semanal.saldo)} destaque />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="metas" className="mt-4 grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Limites de gasto</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="metaDia">Meta diária (R$)</Label>
                    <Input
                      id="metaDia"
                      inputMode="decimal"
                      value={String(metas.gastoDiario)}
                      onChange={(e) =>
                        salvarMetas({ gastoDiario: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="metaSemana">Meta semanal (R$)</Label>
                    <Input
                      id="metaSemana"
                      inputMode="decimal"
                      value={String(metas.gastoSemanal)}
                      onChange={(e) =>
                        salvarMetas({ gastoSemanal: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
                <Barra
                  rotulo="Gasto de hoje"
                  detalhe={`${moeda(dia.gastos)} de ${moeda(metas.gastoDiario)}`}
                  pct={pctDia}
                />
                <Barra
                  rotulo="Gasto da semana"
                  detalhe={`${moeda(semanal.gastos)} de ${moeda(metas.gastoSemanal)}`}
                  pct={pctSemana}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Meta de realização</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="sonho">O que você quer conquistar</Label>
                    <Input
                      id="sonho"
                      value={metas.sonhoNome}
                      onChange={(e) => salvarMetas({ sonhoNome: e.target.value })}
                      placeholder="Viagem, notebook, reserva..."
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="sonhoValor">Valor da meta (R$)</Label>
                    <Input
                      id="sonhoValor"
                      inputMode="decimal"
                      value={String(metas.sonhoValor)}
                      onChange={(e) =>
                        salvarMetas({ sonhoValor: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{metas.sonhoNome || "Sua meta"}</span>
                    <span className="text-muted-foreground">
                      {moeda(metas.sonhoGuardado)} de {moeda(metas.sonhoValor)}
                    </span>
                  </div>
                  <Progress value={Math.min(100, pctSonho)} />
                  <p className="text-sm text-muted-foreground">
                    {pctSonho >= 100
                      ? "Meta conquistada! Você provou que consegue."
                      `: ""`}
                    {pctSonho < 100
                      ? `Faltam ${moeda(
                          Math.max(0, metas.sonhoValor - metas.sonhoGuardado),
                        )} — ${Math.round(pctSonho)}% do caminho já é seu.`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="aporte">Guardar agora (R$)</Label>
                    <Input
                      id="aporte"
                      inputMode="decimal"
                      className="w-40"
                      value={aporte}
                      onChange={(e) => setAporte(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                  <Button
                    onClick={() => {
                      const v = Number(aporte.replace(",", "."));
                      if (!Number.isFinite(v) || v <= 0) {
                        toast.error("Informe um valor para guardar.");
                        return;
                      }
                      guardar(v);
                      setAporte("");
                      toast.success("Valor guardado na sua meta!");
                    }}
                  >
                    Guardar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function Cartao({
  titulo,
  valor,
  tom,
}: {
  titulo: string;
  valor: string;
  tom: "success" | "destructive";
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{titulo}</p>
        <p
          className={`mt-1 text-2xl font-bold ${
            tom === "success" ? "text-success" : "text-destructive"
          }`}
        >
          {valor}
        </p>
      </CardContent>
    </Card>
  );
}

function Linha({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0">
      <span className="text-sm text-muted-foreground">{rotulo}</span>
      <span className={destaque ? "text-lg font-bold" : "font-medium"}>{valor}</span>
    </div>
  );
}

function Barra({
  rotulo,
  detalhe,
  pct,
}: {
  rotulo: string;
  detalhe: string;
  pct: number;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{rotulo}</span>
        <span className="text-muted-foreground">{detalhe}</span>
      </div>
      <Progress value={Math.min(100, pct)} />
      {pct > 100 && (
        <p className="text-sm font-medium text-destructive">
          Acima da meta em {Math.round(pct - 100)}%.
        </p>
      )}
    </div>
  );
}
