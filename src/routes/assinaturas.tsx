import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  CalendarClock,
  CircleCheck,
  CircleDollarSign,
  Clock,
  History,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  Globe,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  alternarSuspensao,
  excluirCliente,
  excluirSite,
  listarPainel,
  meuAcesso,
  renovarAssinatura,
  salvarCliente,
  salvarSite,
} from "@/lib/assinaturas.functions";
import {
  calcularStatus,
  classeStatus,
  contagem,
  dataBR,
  moeda,
  rotuloStatus,
  slugificar,
  type Status,
} from "@/lib/assinaturas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/assinaturas")({
  head: () => ({
    meta: [
      { title: "Painel de Assinaturas — Administração" },
      { name: "description", content: "Dashboard administrativo para gerenciar clientes, sites, assinaturas e pagamentos." },
    ],
  }),
  component: PainelAssinaturas,
});

type Painel = Awaited<ReturnType<typeof listarPainel>>;
type Cliente = Painel["clientes"][number];
type Site = Painel["sites"][number];
type Assinatura = Painel["assinaturas"][number];

function PainelAssinaturas() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const acesso = useQuery({ queryKey: ["acesso"], queryFn: () => meuAcesso() });
  const painel = useQuery({
    queryKey: ["painel"],
    queryFn: () => listarPainel(),
    enabled: acesso.data?.admin === true,
  });

  useEffect(() => {
    if (acesso.error) navigate({ to: "/auth" });
  }, [acesso.error, navigate]);

  const invalidar = () => qc.invalidateQueries({ queryKey: ["painel"] });

  const linhas = useMemo(() => {
    if (!painel.data) return [];
    return painel.data.sites.map((site) => {
      const ass = painel.data.assinaturas.find((a) => a.site_id === site.id);
      const cliente = painel.data.clientes.find((c) => c.id === site.cliente_id);
      const status: Status = ass
        ? calcularStatus(ass.status, site.suspenso_manual, ass.vencimento)
        : "SUSPENSO";
      return { site, ass, cliente, status };
    });
  }, [painel.data]);

  const resumo = useMemo(() => {
    const r = { ATIVO: 0, PROXIMO: 0, EXPIRADO: 0, SUSPENSO: 0 } as Record<Status, number>;
    linhas.forEach((l) => r[l.status]++);
    return r;
  }, [linhas]);

  if (acesso.isLoading || (acesso.data?.admin && painel.isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (acesso.data && !acesso.data.admin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="max-w-md text-center">
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
            <CardDescription>Esta área é exclusiva do administrador.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => supabase.auth.signOut()}>
              Sair da conta
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Painel de Assinaturas</h1>
            <p className="text-sm text-muted-foreground">Clientes, sites, validades e pagamentos</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={invalidar}>
              <RefreshCw className="h-4 w-4" /> Atualizar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
            >
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <CardResumo titulo="Ativos" valor={resumo.ATIVO} cor="text-success" />
          <CardResumo titulo="Próximos do vencimento" valor={resumo.PROXIMO} cor="text-warning" />
          <CardResumo titulo="Expirados" valor={resumo.EXPIRADO} cor="text-destructive" />
          <CardResumo titulo="Suspensos" valor={resumo.SUSPENSO} cor="text-muted-foreground" />
        </div>

        <Tabs defaultValue="sites">
          <TabsList>
            <TabsTrigger value="sites">
              <Globe className="h-4 w-4" /> Sites
            </TabsTrigger>
            <TabsTrigger value="clientes">
              <Users className="h-4 w-4" /> Clientes
            </TabsTrigger>
            <TabsTrigger value="pagamentos">
              <History className="h-4 w-4" /> Pagamentos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sites" className="mt-4">
            <AbaSites
              linhas={linhas}
              clientes={painel.data?.clientes ?? []}
              onMudou={invalidar}
            />
          </TabsContent>
          <TabsContent value="clientes" className="mt-4">
            <AbaClientes clientes={painel.data?.clientes ?? []} onMudou={invalidar} />
          </TabsContent>
          <TabsContent value="pagamentos" className="mt-4">
            <AbaPagamentos painel={painel.data} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function CardResumo({ titulo, valor, cor }: { titulo: string; valor: number; cor: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-muted-foreground">{titulo}</p>
        <p className={`mt-1 text-3xl font-bold ${cor}`}>{valor}</p>
      </CardContent>
    </Card>
  );
}

/* ================= SITES ================= */

function AbaSites({
  linhas,
  clientes,
  onMudou,
}: {
  linhas: { site: Site; ass?: Assinatura; cliente?: Cliente; status: Status }[];
  clientes: Cliente[];
  onMudou: () => void;
}) {
  const [editando, setEditando] = useState<Site | null>(null);
  const [criando, setCriando] = useState(false);
  const [pagando, setPagando] = useState<{ site: Site; ass: Assinatura } | null>(null);

  async function excluir(site: Site) {
    if (!confirm(`Excluir o site "${site.nome}"?`)) return;
    try {
      await excluirSite({ data: { id: site.id } });
      toast.success("Site excluído.");
      onMudou();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir.");
    }
  }

  async function suspender(site: Site, suspenso: boolean) {
    try {
      await alternarSuspensao({ data: { site_id: site.id, suspenso } });
      toast.success(suspenso ? "Site suspenso." : "Site reativado.");
      onMudou();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao alterar.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Sites e assinaturas</CardTitle>
          <CardDescription>Validade, status e renovação de cada site</CardDescription>
        </div>
        <Button size="sm" onClick={() => setCriando(true)} disabled={clientes.length === 0}>
          <Plus className="h-4 w-4" /> Novo site
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {clientes.length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">
            Cadastre um cliente primeiro, na aba Clientes.
          </p>
        )}
        {linhas.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Site / Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Contagem</TableHead>
                <TableHead>Mensalidade</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map(({ site, ass, cliente, status }) => (
                <TableRow key={site.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{site.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {cliente?.nome ?? "—"} · /site/{site.slug}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={classeStatus(status)}>
                      {rotuloStatus[status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{ass ? dataBR(ass.vencimento) : "—"}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-sm">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {ass ? contagem(ass.vencimento) : "—"}
                    </span>
                  </TableCell>
                  <TableCell>{ass ? moeda(Number(ass.valor)) : "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {ass && (
                        <Button
                          size="sm"
                          variant={status === "EXPIRADO" || status === "PROXIMO" ? "default" : "outline"}
                          onClick={() => setPagando({ site, ass })}
                        >
                          <CircleDollarSign className="h-4 w-4" />
                          Pagar mensalidade
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" title="Editar" onClick={() => setEditando(site)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title={site.suspenso_manual ? "Reativar" : "Suspender"}
                        onClick={() => suspender(site, !site.suspenso_manual)}
                      >
                        {site.suspenso_manual ? (
                          <CircleCheck className="h-4 w-4 text-success" />
                        ) : (
                          <Ban className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                      <Button size="icon" variant="ghost" title="Excluir" onClick={() => excluir(site)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {(criando || editando) && (
        <DialogSite
          site={editando}
          clientes={clientes}
          onFechar={() => {
            setCriando(false);
            setEditando(null);
          }}
          onSalvo={() => {
            setCriando(false);
            setEditando(null);
            onMudou();
          }}
        />
      )}

      {pagando && (
        <DialogPagamentoAdmin
          site={pagando.site}
          assinatura={pagando.ass}
          onFechar={() => setPagando(null)}
          onConfirmado={() => {
            setPagando(null);
            onMudou();
          }}
        />
      )}
    </Card>
  );
}

function DialogPagamentoAdmin({
  site,
  assinatura,
  onFechar,
  onConfirmado,
}: {
  site: Site;
  assinatura: Assinatura;
  onFechar: () => void;
  onConfirmado: () => void;
}) {
  const [valor, setValor] = useState(String(Number(assinatura.valor)));
  const [regra, setRegra] = useState<"validade" | "pagamento">("validade");
  const [salvando, setSalvando] = useState(false);

  async function confirmar() {
    setSalvando(true);
    try {
      const v = Number(valor.replace(",", "."));
      const r = await renovarAssinatura({
        data: {
          assinatura_id: assinatura.id,
          regra,
          ...(Number.isFinite(v) ? { valor: v } : {}),
        },
      });
      const novo = Array.isArray(r) ? r[0] : r;
      toast.success(
        `Pagamento confirmado! Novo vencimento: ${novo?.novo_vencimento ? dataBR(novo.novo_vencimento) : "—"}. Site liberado.`,
      );
      onConfirmado();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar pagamento.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pagar mensalidade — {site.nome}</DialogTitle>
          <DialogDescription>
            Confirma o recebimento da mensalidade, registra no histórico, renova a assinatura por{" "}
            {assinatura.periodo_dias} dias e libera o site automaticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="valor-pag">Valor recebido (R$)</Label>
            <Input id="valor-pag" value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label>Regra de renovação</Label>
            <Select value={regra} onValueChange={(v) => setRegra(v as "validade" | "pagamento")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="validade">Somar à validade atual (se ainda ativa)</SelectItem>
                <SelectItem value="pagamento">Contar a partir da data do pagamento</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Assinaturas já vencidas sempre contam a partir de hoje.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={salvando}>
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogSite({
  site,
  clientes,
  onFechar,
  onSalvo,
}: {
  site: Site | null;
  clientes: Cliente[];
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [clienteId, setClienteId] = useState(site?.cliente_id ?? clientes[0]?.id ?? "");
  const [nome, setNome] = useState(site?.nome ?? "");
  const [slug, setSlug] = useState(site?.slug ?? "");
  const [url, setUrl] = useState(site?.url ?? "");
  const [conteudo, setConteudo] = useState(site?.conteudo ?? "");
  const [periodo, setPeriodo] = useState("30");
  const [valor, setValor] = useState("0");
  const [vencimento, setVencimento] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  );
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await salvarSite({
        data: {
          ...(site ? { id: site.id } : {}),
          cliente_id: clienteId,
          nome,
          slug: slug || slugificar(nome),
          url,
          conteudo,
          periodo_dias: Number(periodo),
          valor: Number(valor.replace(",", ".")) || 0,
          vencimento,
        },
      });
      toast.success(site ? "Site atualizado." : "Site criado.");
      onSalvo();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{site ? "Editar site" : "Novo site"}</DialogTitle>
          <DialogDescription>Dados do site e da assinatura do cliente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={salvar} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha o cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nome-site">Nome do site</Label>
              <Input
                id="nome-site"
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value);
                  if (!site) setSlug(slugificar(e.target.value));
                }}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slug-site">Endereço (slug)</Label>
              <Input id="slug-site" value={slug} onChange={(e) => setSlug(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="url-site">URL externa (opcional)</Label>
            <Input id="url-site" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="conteudo-site">Conteúdo exibido no site</Label>
            <Textarea
              id="conteudo-site"
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              rows={4}
              placeholder="Conteúdo que o cliente vê enquanto a assinatura está ativa"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="periodo-site">Período (dias)</Label>
              <Input id="periodo-site" type="number" min={1} value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valor-site">Mensalidade (R$)</Label>
              <Input id="valor-site" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="venc-site">Vencimento</Label>
              <Input id="venc-site" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ================= CLIENTES ================= */

function AbaClientes({ clientes, onMudou }: { clientes: Cliente[]; onMudou: () => void }) {
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setNome(editando?.nome ?? "");
    setEmail(editando?.email ?? "");
    setTelefone(editando?.telefone ?? "");
  }, [editando, criando]);

  const aberto = criando || editando !== null;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await salvarCliente({
        data: { ...(editando ? { id: editando.id } : {}), nome, email, telefone },
      });
      toast.success(editando ? "Cliente atualizado." : "Cliente cadastrado.");
      setCriando(false);
      setEditando(null);
      onMudou();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(c: Cliente) {
    if (!confirm(`Excluir o cliente "${c.nome}" e todos os seus sites?`)) return;
    try {
      await excluirCliente({ data: { id: c.id } });
      toast.success("Cliente excluído.");
      onMudou();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Clientes</CardTitle>
          <CardDescription>Cadastro de clientes assinantes</CardDescription>
        </div>
        <Button size="sm" onClick={() => setCriando(true)}>
          <Plus className="h-4 w-4" /> Novo cliente
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {clientes.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Nenhum cliente cadastrado ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell>{c.telefone ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditando(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => excluir(c)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={aberto} onOpenChange={(o) => { if (!o) { setCriando(false); setEditando(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="nome-cli">Nome</Label>
              <Input id="nome-cli" value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-cli">E-mail</Label>
              <Input id="email-cli" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tel-cli">Telefone</Label>
              <Input id="tel-cli" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={salvando}>
                {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ================= PAGAMENTOS ================= */

function AbaPagamentos({ painel }: { painel?: Painel }) {
  if (!painel) return null;
  const nomeCliente = (id: string) => painel.clientes.find((c) => c.id === id)?.nome ?? "—";
  const nomeSite = (assinaturaId: string) => {
    const ass = painel.assinaturas.find((a) => a.id === assinaturaId);
    return ass ? (painel.sites.find((s) => s.id === ass.site_id)?.nome ?? "—") : "—";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Histórico de pagamentos</CardTitle>
        <CardDescription>Últimos 50 pagamentos registrados</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {painel.pagamentos.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Nenhum pagamento registrado ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Dias adicionados</TableHead>
                <TableHead>Origem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {painel.pagamentos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                      {new Date(p.pago_em).toLocaleString("pt-BR")}
                    </span>
                  </TableCell>
                  <TableCell>{nomeCliente(p.cliente_id)}</TableCell>
                  <TableCell>{nomeSite(p.assinatura_id)}</TableCell>
                  <TableCell className="font-medium">{moeda(Number(p.valor))}</TableCell>
                  <TableCell>+{p.dias_adicionados} dias</TableCell>
                  <TableCell>
                    <Badge variant="outline">{p.origem}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
