import { createServerFn } from "@tanstack/react-start";

export type Cobranca = {
  transactionId: string;
  valor: number;
  pixCopiaECola: string | null;
  qrCodeImagem: string | null;
};

function textoDe(obj: Record<string, unknown>, chaves: string[]): string | null {
  for (const c of chaves) {
    const v = obj[c];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

/** Cria a cobrança da mensalidade no MisticPay para o site informado. */
export const criarCobrancaMensalidade = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string; nome: string; documento: string }) => {
    if (!/^[a-z0-9-]{1,60}$/.test(d.slug)) throw new Error("Endereço inválido.");
    if (!d.nome?.trim() || d.nome.trim().length < 3) throw new Error("Informe o nome completo.");
    const doc = (d.documento ?? "").replace(/\D/g, "");
    if (doc.length !== 11 && doc.length !== 14) throw new Error("Informe um CPF ou CNPJ válido.");
    return { slug: d.slug, nome: d.nome.trim(), documento: doc };
  })
  .handler(async ({ data }): Promise<Cobranca> => {
    const ci = process.env["MISTICPAY_CLIENT_ID"];
    const cs = process.env["MISTICPAY_CLIENT_SECRET"];
    if (!ci || !cs) throw new Error("Pagamento online ainda não configurado.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: site, error: erroSite } = await supabaseAdmin
      .from("sites")
      .select("id, nome")
      .eq("slug", data.slug)
      .maybeSingle();
    if (erroSite) throw new Error(erroSite.message);
    if (!site) throw new Error("Site não encontrado.");

    const { data: ass, error: erroAss } = await supabaseAdmin
      .from("assinaturas")
      .select("id, valor")
      .eq("site_id", site.id)
      .maybeSingle();
    if (erroAss) throw new Error(erroAss.message);
    if (!ass) throw new Error("Este site não possui assinatura cadastrada.");

    const valor = Number(ass.valor ?? 0);
    if (!(valor > 0)) throw new Error("Valor da mensalidade não configurado.");

    // O id da assinatura vai no início do transactionId para o webhook identificar o cliente.
    const transactionId = `${ass.id}.${Date.now().toString(36)}`;

    const resposta = await fetch("https://api.misticpay.com/api/transactions/create", {
      method: "POST",
      headers: { ci, cs, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: valor,
        payerName: data.nome,
        payerDocument: data.documento,
        transactionId,
        description: `Mensalidade do site ${site.nome}`,
      }),
    });

    const bruto = await resposta.text();
    if (!resposta.ok) {
      console.error("[MisticPay] falha ao criar transação", resposta.status, bruto);
      throw new Error("Não foi possível gerar o pagamento agora. Tente novamente.");
    }

    let corpo: Record<string, unknown> = {};
    try {
      const json = JSON.parse(bruto) as unknown;
      if (json && typeof json === "object") corpo = json as Record<string, unknown>;
    } catch {
      corpo = {};
    }
    const dados =
      corpo["data"] && typeof corpo["data"] === "object"
        ? (corpo["data"] as Record<string, unknown>)
        : corpo;

    return {
      transactionId,
      valor,
      pixCopiaECola: textoDe(dados, [
        "pixCopyPaste",
        "copyPaste",
        "qrCodeText",
        "qrcode",
        "qrCode",
        "brcode",
        "emv",
        "pix",
      ]),
      qrCodeImagem: textoDe(dados, ["qrCodeImage", "qrCodeBase64", "qrcodeImage", "image"]),
    };
  });
