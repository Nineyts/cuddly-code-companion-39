import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type StatusAssinatura = "ATIVO" | "PROXIMO" | "EXPIRADO" | "SUSPENSO";

function clientePublico() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

async function exigirAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

export const meuAcesso = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { admin: Boolean(data), userId: context.userId };
  });

export const listarPainel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context as never);
    const { supabase } = context;

    const [clientes, sites, assinaturas, pagamentos] = await Promise.all([
      supabase.from("clientes").select("*").order("nome"),
      supabase.from("sites").select("*").order("created_at", { ascending: false }),
      supabase.from("assinaturas").select("*"),
      supabase
        .from("pagamentos")
        .select("*")
        .order("pago_em", { ascending: false })
        .limit(50),
    ]);

    const erro =
      clientes.error ?? sites.error ?? assinaturas.error ?? pagamentos.error ?? null;
    if (erro) throw new Error(erro.message);

    return {
      clientes: clientes.data ?? [],
      sites: sites.data ?? [],
      assinaturas: assinaturas.data ?? [],
      pagamentos: pagamentos.data ?? [],
    };
  });

export const salvarCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string;
      nome: string;
      email?: string;
      telefone?: string;
      observacoes?: string;
    }) => {
      if (!d.nome?.trim()) throw new Error("Informe o nome do cliente.");
      return d;
    },
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context as never);
    const linha = {
      nome: data.nome.trim(),
      email: data.email?.trim() || null,
      telefone: data.telefone?.trim() || null,
      observacoes: data.observacoes?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const q = data.id
      ? context.supabase.from("clientes").update(linha).eq("id", data.id).select().single()
      : context.supabase.from("clientes").insert(linha).select().single();
    const { data: cliente, error } = await q;
    if (error) throw new Error(error.message);
    return cliente;
  });

export const excluirCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await exigirAdmin(context as never);
    const { error } = await context.supabase.from("clientes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const salvarSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string;
      cliente_id: string;
      nome: string;
      slug: string;
      url?: string;
      conteudo?: string;
      periodo_dias: number;
      valor: number;
      vencimento: string;
    }) => {
      if (!d.cliente_id) throw new Error("Escolha o cliente.");
      if (!d.nome?.trim()) throw new Error("Informe o nome do site.");
      if (!/^[a-z0-9-]{2,60}$/.test(d.slug))
        throw new Error("Endereço inválido: use apenas letras minúsculas, números e -.");
      if (!d.vencimento) throw new Error("Informe a data de vencimento.");
      if (!Number.isFinite(d.periodo_dias) || d.periodo_dias < 1)
        throw new Error("Período da assinatura inválido.");
      return d;
    },
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context as never);
    const { supabase } = context;

    const linhaSite = {
      cliente_id: data.cliente_id,
      nome: data.nome.trim(),
      slug: data.slug,
      url: data.url?.trim() || null,
      conteudo: data.conteudo ?? "",
      updated_at: new Date().toISOString(),
    };

    const { data: site, error } = data.id
      ? await supabase.from("sites").update(linhaSite).eq("id", data.id).select().single()
      : await supabase.from("sites").insert(linhaSite).select().single();
    if (error) throw new Error(error.message);

    const linhaAss = {
      site_id: site.id,
      cliente_id: data.cliente_id,
      periodo_dias: Math.round(data.periodo_dias),
      valor: data.valor,
      vencimento: data.vencimento,
      status: data.vencimento < new Date().toISOString().slice(0, 10) ? "expirado" : "ativo",
    };
    const { error: e2 } = await supabase
      .from("assinaturas")
      .upsert(linhaAss, { onConflict: "site_id" });
    if (e2) throw new Error(e2.message);

    return site;
  });

export const excluirSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await exigirAdmin(context as never);
    const { error } = await context.supabase.from("sites").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renovarAssinatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { assinatura_id: string; valor?: number; regra?: "validade" | "pagamento" }) => d,
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context as never);
    const { data: r, error } = await context.supabase.rpc("renovar_assinatura", {
      _assinatura_id: data.assinatura_id,
      _origem: "manual",
      _regra: data.regra ?? "validade",
      ...(data.valor !== undefined ? { _valor: data.valor } : {}),
    });
    if (error) throw new Error(error.message);
    return r;
  });

export const alternarSuspensao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { site_id: string; suspenso: boolean }) => d)
  .handler(async ({ data, context }) => {
    await exigirAdmin(context as never);
    const { error } = await context.supabase
      .from("sites")
      .update({ suspenso_manual: data.suspenso, updated_at: new Date().toISOString() })
      .eq("id", data.site_id);
    if (error) throw new Error(error.message);

    const { data: ass } = await context.supabase
      .from("assinaturas")
      .select("id, vencimento")
      .eq("site_id", data.site_id)
      .maybeSingle();
    if (ass) {
      const hoje = new Date().toISOString().slice(0, 10);
      const status = data.suspenso
        ? "suspenso"
        : ass.vencimento < hoje
          ? "expirado"
          : "ativo";
      await context.supabase.from("assinaturas").update({ status }).eq("id", ass.id);
    }
    return { ok: true };
  });

export const detalhesCliente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await exigirAdmin(context as never);
    const { supabase } = context;

    const { data: cliente, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const [sites, assinaturas, pagamentos] = await Promise.all([
      supabase.from("sites").select("*").eq("cliente_id", data.id).order("nome"),
      supabase.from("assinaturas").select("*").eq("cliente_id", data.id),
      supabase
        .from("pagamentos")
        .select("*")
        .eq("cliente_id", data.id)
        .order("pago_em", { ascending: false }),
    ]);

    const ids = (assinaturas.data ?? []).map((a) => a.id);
    const historico = ids.length
      ? (
          await supabase
            .from("historico_validade")
            .select("*")
            .in("assinatura_id", ids)
            .order("created_at", { ascending: false })
        ).data ?? []
      : [];

    return {
      cliente,
      sites: sites.data ?? [],
      assinaturas: assinaturas.data ?? [],
      pagamentos: pagamentos.data ?? [],
      historico,
    };
  });

// Verificação pública: o banco decide se o conteúdo é entregue.
export const verificarSite = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => {
    if (!/^[a-z0-9-]{1,60}$/.test(d.slug)) throw new Error("Endereço inválido.");
    return d;
  })
  .handler(async ({ data }) => {
    const { data: linhas, error } = await clientePublico().rpc("verificar_site", {
      _slug: data.slug,
    });
    if (error) throw new Error(error.message);
    const linha = (linhas ?? [])[0];
    if (!linha) return null;
    return {
      site_nome: linha.site_nome as string,
      cliente_nome: linha.cliente_nome as string,
      status: linha.status as StatusAssinatura,
      vencimento: linha.vencimento as string,
      dias_restantes: linha.dias_restantes as number,
      conteudo: (linha.conteudo as string | null) ?? null,
      valor: Number(linha.valor ?? 0),
    };
  });
