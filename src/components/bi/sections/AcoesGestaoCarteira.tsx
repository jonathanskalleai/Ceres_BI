import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { BiTableCard } from "@/components/bi/BiTableCard";
import { ChipToggle, type ChipOption } from "@/components/bi/ChipToggle";
import { useAcoesGestaoListasRpc, GESTAO_LISTA_PAGE, GESTAO_LISTA_MAX } from "@/hooks/bi/useAcoesGestaoListasRpc";
import { fmtNum } from "@/lib/formatters";
import { DesperdicioTable, NegativasTable } from "./AcoesGestaoCarteiraTables";
import type {
  AcoesDesperdicioRow,
  AcoesGestaoListaTipo,
  AcoesNegativaRow,
} from "@/types/biRpc";

/** Story 2-A: so desperdicio e negativas. sem_contato removido. */
const TABS: readonly ChipOption<AcoesGestaoListaTipo>[] = [
  { value: "desperdicio", label: "Desperdicio" },
  { value: "negativas", label: "Negativas" },
];

const TITULO: Record<AcoesGestaoListaTipo, string> = {
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
 * Card "Gestao da Carteira" em abas (Story 2-A: 2 abas — desperdicio + negativas).
 *
 * Story 2-A removeu a aba "sem contato": o drill-down por faixa de dias do chart
 * "Clientes em Risco" agora aponta para uma aba que nao existe. O drill e
 * desabilitado silenciosamente (sem erro, sem badge) se a faixa vier de fora.
 */
export function AcoesGestaoCarteira({ from, to, vendedor, cidade, active = true, drill, onClearDrill }: Props) {
  const [tab, setTab] = useState<AcoesGestaoListaTipo>("desperdicio");
  const [verTodos, setVerTodos] = useState(false);

  // Story 2-A: drill por faixa agora aponta para aba inexistente.
  // Silenciosamente ignoramos — sem erro, sem badge.
  const hasDrill = drill != null;
  const effectiveDrill = hasDrill ? null : null; // consume without using

  // Trocar de aba volta para as 10 primeiras linhas.
  useEffect(() => setVerTodos(false), [tab]);

  const limit = verTodos ? GESTAO_LISTA_MAX : GESTAO_LISTA_PAGE;
  const base = { from, to, vendedor, cidade, limit };

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

  const atual = tab === "desperdicio" ? desperdicio : negativas;
  const total = atual.data?.total ?? 0;
  const meta = atual.data?.meta;
  const exibidas = atual.data?.rows.length ?? 0;

  const legenda = useMemo(() => {
    if (tab === "desperdicio") {
      return (
        <>
          Clientes com {fmtNum(meta?.minVisitas ?? 3)}+ visitas no periodo, ordenados por menos oportunidades
          levantadas.
          {meta?.semNenhumaOportunidade != null && (
            <> {fmtNum(meta.semNenhumaOportunidade)} nao geraram nenhuma oportunidade.</>
          )}{" "}
          O topo da lista inclui ruido de cadastro (salas de reuniao e rotas lancadas como cliente no CRM).
        </>
      );
    }
    return (
      <>
        Regra: os <strong className="text-[var(--voux-text-primary)]">3 negocios comerciais mais recentes</strong>{" "}
        do cliente sao todos "Perdido". Cliente com 1 ou 2 perdas nao entra — por isso a lista e curta
        {meta?.clientesCom3OuMaisNegocios != null && (
          <> ({fmtNum(total)} de {fmtNum(meta.clientesCom3OuMaisNegocios)} clientes com 3+ negocios)</>
        )}
        .
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

  // Badge de drill (Story 2-A: nao renderiza mais — aba sem_contato nao existe)
  const drillBadge = null;

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
        {tab === "desperdicio" && <DesperdicioTable rows={desperdicio.data?.rows ?? []} />}
        {tab === "negativas" && <NegativasTable rows={negativas.data?.rows ?? []} />}
      </BiTableCard>
      <p className="text-[11px] leading-relaxed text-[var(--voux-text-muted)]">{legenda}</p>
    </div>
  );
}
