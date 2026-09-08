import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook do MisticPay: confirma o pagamento e renova a assinatura automaticamente.
 * URL: /api/public/misticpay?token=MISTICPAY_WEBHOOK_TOKEN
 */
export const Route = createFileRoute("/api/public/misticpay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env["MISTICPAY_WEBHOOK_TOKEN"];
        const enviado = new URL(request.url).searchParams.get("token");
        if (!token || enviado !== token) {
          return new Response("Unauthorized", { status: 401 });
        }

        let corpo: Record<string, unknown> = {};
        try {
          const json = (await request.json()) as unknown;
          if (json && typeof json === "object") corpo = json as Record<string, unknown>;
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const dados =
          corpo["data"] && typeof corpo["data"] === "object"
            ? (corpo["data"] as Record<string, unknown>)
            : corpo;

        const transactionId =
          typeof dados["transactionId"] === "string" ? (dados["transactionId"] as string) : null;
        const status = String(dados["status"] ?? corpo["status"] ?? "").toUpperCase();

        if (!transactionId) return new Response("Missing transactionId", { status: 400 });

        const pago = ["PAID", "APPROVED", "COMPLETED", "CONFIRMED", "SUCCESS"].includes(status);
        if (!pago) return new Response("ignored", { status: 200 });

        const assinaturaId = transactionId.split(".")[0] ?? "";
        if (!/^[0-9a-f-]{36}$/i.test(assinaturaId)) {
          return new Response("Unknown transaction", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Evita renovar duas vezes pelo mesmo pagamento.
        const { data: jaExiste } = await supabaseAdmin
          .from("pagamentos")
          .select("id")
          .eq("referencia", transactionId)
          .maybeSingle();
        if (jaExiste) return new Response("duplicate", { status: 200 });

        const valorNum = Number(dados["amount"] ?? dados["value"] ?? 0);

        const { error } = await supabaseAdmin.rpc("renovar_assinatura", {
          _assinatura_id: assinaturaId,
          _origem: "misticpay",
          _referencia: transactionId,
          _regra: "validade",
          ...(valorNum > 0 ? { _valor: valorNum } : {}),
        });
        if (error) {
          console.error("[MisticPay] falha ao renovar", error.message);
          return new Response("error", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
