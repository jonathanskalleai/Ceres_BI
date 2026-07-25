import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { BiTableCard } from "@/components/bi/BiTableCard";
import { ChipToggle, type ChipOption } from "@/components/bi/ChipToggle";
import { useAcoesGestaoListasRpc, GESTAO_LISTA_PAGE, GESTAO_LISTA_MAX } from "@/hooks/bi/useAcoesGestaoListasRpc";
import { fmtNum } from "@/lib/formatters";
import { DesperdicioTable, NegativasTable, SemContatoTable } from "./AcoesGestaoCarteiraTables";
import type {
  AcoesDesperdicioRow,
  AcoesGestaoListaTipo,
  AcoesNegativaRow,
  AcoesSemContatoRow,
} from "@/types/biRpc";

const TABS: readonly ChipOption<AcoesGestaoListaTipo>[] = [
  { value: "sem_contato", label: "Sem contato" },
  { value: "desperdicio", label: "Desperdicio" },
  { value: "negativas", label: "Negativas" },
];

const TITULO: Record<AcoesGestaoListaTipo, string> = {
  sem_contato: "Gestao da Carteira · Clientes sem contato",
  desperdicio: "Gestao da Carteira · Esforco sem retorno",
  negativas: "Gestao da Carteira · Clientes negativos",
};

/** Faixa clicada no chart "Clientes em Risco" — drill-down vindo de fora. */
export interface CarteiraDrill {
  faixa: string;
  diasMin: number;
  diasMax?: number;
}

interface Props {
  from?: string;
  to?: string;
  vendedor?: string;
  cidade?: string;
  active?: boolean;
  drill?: CarteiraDrill | null;
  onClearDrill?: () => void;
}

/**
 * Card "Gestao da Carteira" em abas (pedidos 4, 5 e 9).
 *
 * Tres abas em vez de tres tabelas soltas: a tela ja tem 7 graficos e 3
 * tabelas, e mais tres blocos empilhados viram muro de dados que ninguem le.
 *
 * A paginacao e SERVER-SIDE: a aba "sem contato" percorre a carteira inteira
 * (8.731 clientes) — trazer tudo para renderizar 10 linhas foi exatamente o
 * erro que motivou separar estas listas do payload agregado.
 */
export function AcoesGestaoCarteira({ from, to, vendedor, cidade, active = true, drill, onClearDrill }: Props) {
  const [tab, setTab] = useState<AcoesGestaoListaTipo>("sem_contato");
  const [verTodos, setVerTodos] = useState(false);

  // Clique numa faixa do chart de risco: a aba certa e a lista recortada.
  useEffect(() => {
    if (drill) {
      setTab("sem_contato");
      setVerTodos(false);
    }
  }, [drill]);

  // Trocar de aba volta para as 10 primeiras linhas — "ver todos" e por aba.
  useEffect(() => setVerTodos(false), [tab]);

  const limit = verTodos ? GESTAO_LISTA_MAX : GESTAO_LISTA_PAGE;
  const base = { from, to, vendedor, cidade, limit };

  const semContato = useAcoesGestaoListasRpc<AcoesSemContatoRow>({
    ...base,
    tipo: "sem_contato",
    diasMin: drill?.diasMin,
    diasMax: drill?.diasMax,
    enabled: active && tab === "sem_contato",
  });
  const desperdicio = useAcoesGestaoListasRpc<AcoesDesperdicioRow>({
    ...base,
    tipo: "desperdicio",
    enabled: active && tab === "desperdicio",
  });
  const negativas = useAcoesGestaoListasRpc<AcoesNegativaRow>({
    ...base,
    tipo: "negativas",
    enabled: active && tab === "negativas",
  });

  const atual = tab === "sem_contato" ? semContato : tab === "desperdicio" ? desperdicio : negativas;
  const total = atual.data?.total ?? 0;
  const meta = atual.data?.meta;
  const exibidas = atual.data?.rows.length ?? 0;

  const legenda = useMemo(() => {
    if (tab === "sem_contato") {
      return (
        <>
          Dias contados a partir da ultima acao no ano corrente — mesma regra do grafico “Clientes em Risco”,
          para as duas leituras baterem. Cliente sem nenhuma acao no ano aparece como{" "}
          <strong className="text-[var(--voux-text-primary)]">“Sem acao no ano”</strong>, nunca como “999
          dias”.
          {meta?.comOportunidadeAberta != null && (
            <> {fmtNum(meta.comOportunidadeAberta)} deles tem negocio aberto — esses sao dinheiro na mesa.</>
          )}
        </>
      );
    }
    if (tab === "desperdicio") {
      return (
        <>
          Clientes com {fmtNum(meta?.minVisitas ?? 3)}+ visitas no periodo, ordenados por menos oportunidades
          levantadas.
          {meta?.semNenhumaOportunidade != null && (
            <> {fmtNum(meta.semNenhumaOportunidade)} nao geraram nenhuma oportunidade.</>
          )}{" "}
          O topo da lista inclui ruido de cadastro (salas de reuniao e rotas lancadas como cliente no CRM) —
          nao ha filtro de limpeza aqui de proposito: esconder registro nao corrige cadastro.
        </>
      );
    }
    return (
      <>
        Regra: os <strong className="text-[var(--voux-text-primary)]">3 negocios comerciais mais recentes</strong>{" "}
        do cliente sao todos “Perdido”. Cliente com 1 ou 2 perdas nao entra — por isso a lista e curta
        {meta?.clientesCom3OuMaisNegocios != null && (
          <> ({fmtNum(total)} de {fmtNum(meta.clientesCom3OuMaisNegocios)} clientes com 3+ negocios)</>
        )}
        . Nao e falha de carregamento.
      </>
    );
  }, [tab, meta, total]);

  const podeExpandir = !verTodos && total > exibidas;

  const footer = podeExpandir ? (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setVerTodos(true)}
        className="h-8 rounded-full border border-[var(--voux-card-border)] px-4 text-xs font-medium text-[var(--voux-text-primary)] transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--voux-champagne-400)]"
      >
        Ver todos ({fmtNum(total)})
      </button>
    </div>
  ) : null;

  // Badge e legenda ficam FORA do BiTableCard: no estado vazio o card
  // early-returna, e e justamente quando a lista vem curta/vazia que o gestor
  // precisa ler a regra e conseguir limpar o filtro de faixa.
  const drillBadge = drill && tab === "sem_contato" && (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--voux-champagne-400)]/40 bg-[var(--voux-champagne-400)]/[0.08] px-3 py-2 text-[11px]">
      <span className="text-[var(--voux-text-primary)]">
        Filtrado pela faixa <strong>{drill.faixa}</strong> dias do grafico “Clientes em Risco”.
      </span>
      {onClearDrill && (
        <button
          type="button"
          onClick={onClearDrill}
          className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[var(--voux-text-muted)] transition-colors hover:text-[var(--voux-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--voux-champagne-400)]"
          aria-label="Remover filtro de faixa de dias"
        >
          <X className="h-3 w-3" aria-hidden="true" />
          limpar
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {drillBadge}
      <BiTableCard
        title={`${TITULO[tab]} · ${fmtNum(exibidas)} de ${fmtNum(total)}`}
        actions={
          <ChipToggle
            options={TABS}
            value={tab}
            onChange={setTab}
            ariaLabel="Escolher lista da gestao da carteira"
          />
        }
        loading={atual.isLoading}
        error={atual.error}
        isEmpty={exibidas === 0}
        emptyMessage="Nenhum cliente atende a regra desta lista no recorte atual."
        skeletonRows={GESTAO_LISTA_PAGE}
        footer={footer}
      >
        {tab === "sem_contato" && <SemContatoTable rows={semContato.data?.rows ?? []} />}
        {tab === "desperdicio" && <DesperdicioTable rows={desperdicio.data?.rows ?? []} />}
        {tab === "negativas" && <NegativasTable rows={negativas.data?.rows ?? []} />}
      </BiTableCard>
      <p className="text-[11px] leading-relaxed text-[var(--voux-text-muted)]">{legenda}</p>
    </div>
  );
}
