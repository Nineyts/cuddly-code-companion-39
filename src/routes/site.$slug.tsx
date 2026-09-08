import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Ban, Clock, CreditCard, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { verificarSite } from "@/lib/assinaturas.functions";
import { criarCobrancaMensalidade } from "@/lib/pagamentos.functions";
import { dataBR, moeda } from "@/lib/assinaturas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/site/$slug")({
  head: () => ({
    meta: [
      { title: "Site do cliente" },
      { name: "description", content: "Página do site do cliente com verificação de assinatura." },
    ],
  }),
  component: PaginaSite,
});

function PaginaSite() {
  const { slug } = useParams({ from: "/site/$slug" });
  const [pagamentoAberto, setPagamentoAberto] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["site", slug],
    queryFn: () => verificarSite({ data: { slug } }),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Site não encontrado</CardTitle>
            <CardDescription>Verifique o endereço informado.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/">Voltar ao início</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // O conteúdo só chega do servidor quando a assinatura está ATIVA ou PRÓXIMA do vencimento.
  if (data.conteudo != null) {
    return (
      <div className="min-h-screen bg-background">
        {data.status === "PROXIMO" && (
          <div className="bg-warning/15 px-4 py-2 text-center text-sm text-warning-foreground">
            Sua assinatura vence em {dataBR(data.vencimento)} ({data.dias_restantes} dia
            {data.dias_restantes === 1 ? "" : "s"}).{" "}
            <button className="font-semibold underline" onClick={() => setPagamentoAberto(true)}>
              Pagar mensalidade
            </button>{" "}
            para evitar a suspensão.
          </div>
        )}
        <main className="mx-auto max-w-3xl px-4 py-10">
          <p className="text-sm text-muted-foreground">Site de {data.cliente_nome}</p>
          <h1 className="mt-1 text-3xl font-bold text-foreground">{data.site_nome}</h1>

          <div
            className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
              data.dias_restantes <= 5
                ? "border-warning/40 bg-warning/10"
                : "border-border bg-muted/40"
            }`}
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                {data.dias_restantes < 0 ? (
                  <>
                    Assinatura <strong>vencida</strong> desde {dataBR(data.vencimento)}.
                  </>
                ) : data.dias_restantes === 0 ? (
                  <>
                    A mensalidade <strong>vence hoje</strong> ({dataBR(data.vencimento)}).
                  </>
                ) : data.dias_restantes === 1 ? (
                  <>
                    Falta <strong>1 dia</strong> para a próxima mensalidade (
                    {dataBR(data.vencimento)}).
                  </>
                ) : (
                  <>
                    Faltam <strong>{data.dias_restantes} dias</strong> para a próxima mensalidade (
                    {dataBR(data.vencimento)}).
                  </>
                )}
              </span>
            </div>
            {data.dias_restantes <= 5 && (
              <Button size="sm" onClick={() => setPagamentoAberto(true)}>
                <CreditCard className="h-4 w-4" />
                Pagar agora ({moeda(data.valor)})
              </Button>
            )}
          </div>

          <div
            className="prose mt-6 max-w-none whitespace-pre-wrap text-foreground"
            dangerouslySetInnerHTML={{ __html: data.conteudo }}
          />
        </main>
        <DialogoPagamento
          aberto={pagamentoAberto}
          onFechar={() => setPagamentoAberto(false)}
          siteNome={data.site_nome}
          valor={data.valor}
          vencimento={data.vencimento}
        />
      </div>
    );
  }

  const suspenso = data.status === "SUSPENSO";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-destructive/40 text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            {suspenso ? (
              <Ban className="h-7 w-7 text-destructive" />
            ) : (
              <ShieldAlert className="h-7 w-7 text-destructive" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {suspenso ? "Site suspenso" : "Assinatura vencida"}
          </CardTitle>
          <CardDescription>
            {suspenso
              ? `O site ${data.site_nome} foi suspenso. Entre em contato com o administrador ou regularize o pagamento.`
              : `A assinatura de ${data.site_nome} venceu em ${dataBR(data.vencimento)}. Renove para liberar o acesso imediatamente.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Mensalidade: <strong className="text-foreground">{moeda(data.valor)}</strong>
          </div>
          <Button className="w-full" size="lg" onClick={() => setPagamentoAberto(true)}>
            <CreditCard className="h-4 w-4" />
            Pagar mensalidade
          </Button>
        </CardContent>
      </Card>

      <DialogoPagamento
        aberto={pagamentoAberto}
        onFechar={() => setPagamentoAberto(false)}
        siteNome={data.site_nome}
        valor={data.valor}
        vencimento={data.vencimento}
      />
    </div>
  );
}

function DialogoPagamento({
  aberto,
  onFechar,
  siteNome,
  valor,
  vencimento,
}: {
  aberto: boolean;
  onFechar: () => void;
  siteNome: string;
  valor: number;
  vencimento: string;
}) {
  const { slug } = useParams({ from: "/site/$slug" });
  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const criar = useServerFn(criarCobrancaMensalidade);

  const cobrar = useMutation({
    mutationFn: () => criar({ data: { slug, nome, documento } }),
    onError: (e: Error) => toast.error(e.message),
  });
  const cobranca = cobrar.data;

  return (
    <Dialog
      open={aberto}
      onOpenChange={(o) => {
        if (!o) {
          cobrar.reset();
          onFechar();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pagar mensalidade — {siteNome}</DialogTitle>
          <DialogDescription>
            Valor da mensalidade: <strong>{moeda(valor)}</strong> · vencimento atual em{" "}
            {dataBR(vencimento)}.
          </DialogDescription>
        </DialogHeader>

        {cobranca ? (
          <div className="space-y-3">
            {cobranca.qrCodeImagem && (
              <img
                src={
                  cobranca.qrCodeImagem.startsWith("data:")
                    ? cobranca.qrCodeImagem
                    : `data:image/png;base64,${cobranca.qrCodeImagem}`
                }
                alt="QR Code do Pix da mensalidade"
                className="mx-auto h-48 w-48 rounded-lg border bg-card p-2"
              />
            )}
            {cobranca.pixCopiaECola && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Pix copia e cola</p>
                <textarea
                  readOnly
                  value={cobranca.pixCopiaECola}
                  className="h-24 w-full rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground"
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    void navigator.clipboard.writeText(cobranca.pixCopiaECola ?? "");
                    toast.success("Código Pix copiado!");
                  }}
                >
                  Copiar código Pix
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Assim que o pagamento for confirmado, a assinatura é renovada e o site liberado
              automaticamente.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="pg-nome">Nome completo</Label>
              <Input
                id="pg-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Daniel Vorcaro"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pg-doc">CPF ou CNPJ</Label>
              <Input
                id="pg-doc"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                placeholder="12345678909"
                inputMode="numeric"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>
            Fechar
          </Button>
          {!cobranca && (
            <Button disabled={cobrar.isPending} onClick={() => cobrar.mutate()}>
              {cobrar.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              Gerar pagamento Pix
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

