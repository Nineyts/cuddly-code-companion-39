import { useCallback, useEffect, useState } from "react";

export type Tipo = "entrada" | "gasto";

export type Lancamento = {
  id: string;
  tipo: Tipo;
  descricao: string;
  valor: number;
  data: string; // YYYY-MM-DD
  criadoEm: number;
};

export type Metas = {
  gastoDiario: number;
  gastoSemanal: number;
  sonhoNome: string;
  sonhoValor: number;
  sonhoGuardado: number;
};

export type Estado = {
  lancamentos: Lancamento[];
  metas: Metas;
};

const CHAVE = "controle-financeiro-v1";

export const estadoInicial: Estado = {
  lancamentos: [],
  metas: {
    gastoDiario: 80,
    gastoSemanal: 500,
    sonhoNome: "Minha conquista",
    sonhoValor: 3000,
    sonhoGuardado: 0,
  },
};

export function hojeISO(d = new Date()) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function inicioDaSemanaISO(d = new Date()) {
  const dia = (d.getDay() + 6) % 7; // segunda = 0
  const inicio = new Date(d);
  inicio.setDate(d.getDate() - dia);
  return hojeISO(inicio);
}

export function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const motivacoes = [
  "Cada real guardado hoje é liberdade amanhã.",
  "Você não está se privando, está escolhendo o que importa.",
  "Disciplina é lembrar do que você quer de verdade.",
  "Pequenos cortes, grandes conquistas.",
  "O seu eu do futuro agradece o seu eu de hoje.",
  "Gastar menos que ganha é o único segredo.",
  "Progresso vale mais que perfeição: siga registrando.",
  "Sua meta não desistiu de você. Não desista dela.",
  "Hoje é mais um dia de vitória sobre o impulso.",
  "Riqueza é o que você não gastou por bobagem.",
  "Constância vence pressa toda vez.",
  "Você está a um dia mais perto do seu objetivo.",
  "Anote tudo: o que se mede, se melhora.",
  "Dinheiro tranquilo é sono tranquilo.",
];

export function motivacaoDoDia(dataISO: string) {
  const soma = dataISO.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return motivacoes[soma % motivacoes.length];
}

export function useFinancas() {
  const [estado, setEstado] = useState<Estado>(estadoInicial);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    try {
      const bruto = localStorage.getItem(CHAVE);
      if (bruto) {
        const salvo = JSON.parse(bruto) as Partial<Estado>;
        setEstado({
          lancamentos: salvo.lancamentos ?? [],
          metas: { ...estadoInicial.metas, ...(salvo.metas ?? {}) },
        });
      }
    } catch {
      /* ignora dados inválidos */
    }
    setPronto(true);
  }, []);

  useEffect(() => {
    if (!pronto) return;
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  }, [estado, pronto]);

  const adicionar = useCallback(
    (dados: { tipo: Tipo; descricao: string; valor: number; data: string }) => {
      setEstado((s) => ({
        ...s,
        lancamentos: [
          {
            id: crypto.randomUUID(),
            criadoEm: Date.now(),
            ...dados,
          },
          ...s.lancamentos,
        ],
      }));
    },
    [],
  );

  const remover = useCallback((id: string) => {
    setEstado((s) => ({
      ...s,
      lancamentos: s.lancamentos.filter((l) => l.id !== id),
    }));
  }, []);

  const salvarMetas = useCallback((metas: Partial<Metas>) => {
    setEstado((s) => ({ ...s, metas: { ...s.metas, ...metas } }));
  }, []);

  const guardar = useCallback((valor: number) => {
    setEstado((s) => ({
      ...s,
      metas: {
        ...s.metas,
        sonhoGuardado: Math.max(0, s.metas.sonhoGuardado + valor),
      },
    }));
  }, []);

  return { estado, pronto, adicionar, remover, salvarMetas, guardar };
}

export function resumo(lancamentos: Lancamento[], filtro: (l: Lancamento) => boolean) {
  const itens = lancamentos.filter(filtro);
  const entradas = itens
    .filter((l) => l.tipo === "entrada")
    .reduce((a, l) => a + l.valor, 0);
  const gastos = itens
    .filter((l) => l.tipo === "gasto")
    .reduce((a, l) => a + l.valor, 0);
  return { itens, entradas, gastos, saldo: entradas - gastos };
}
