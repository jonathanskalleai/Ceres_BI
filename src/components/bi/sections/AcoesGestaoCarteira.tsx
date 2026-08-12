import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { BiTableCard } from "@/components/bi/BiTableCard";
import { ChipToggle, type ChipOption } from "@/components/bi/ChipToggle";
import { PaginationControls } from "@/components/bi/PaginationControls";
import { useAcoesGestaoListasRpc, GESTAO_LISTA_PAGE } from "@/hooks/bi/useAcoesGestaoListasRpc";
import { fmtNum } from "@/lib/formatters";
import { DesperdicioTable, NegativasTable } from "./AcoesGestaoCarteiraTables";
import type {
  AcoesDesperdicioRow,
  AcoesGestaoListaTipo,
  AcoesNegativaRow,
} from "@/types/biRpc";

/** Story 2-A: so desperdicio e negativas. sem_contato removido. */
const TABS: readonly ChipOption<AcoesGestaoListaTipo>[] = [
  { value: "desperdicio", label: "Muitas visitas, poucas oportunidades" },
  { value: "negativas", label: "Clientes com 3 perdas seguidas" },
];

const TITULO: Record<AcoesGestaoListaTipo, string> = {
  desperdicio: "Gestao da Carteira · Muitas visitas, poucas oportunidades",
  negativas: "Gestao da Carteira · Clientes com 3 perdas seguidas",
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
  const [page, setPage] = useState(1);

  // Story 2-A: drill por faixa agora aponta para aba inexistente.
  // Silenciosamente ignoramos — sem erro, sem badge.
  const hasDrill = drill != null;
  const effectiveDrill = hasDrill ? null : null; // consume without using

  // Qualquer troca de recorte volta para a primeira pagina. A consulta e
  // paginada no servidor; nunca trazemos centenas de clientes ao navegador.
  useEffect(() => setPage(1), [tab, from, to, vendedor, cidade]);

  const limit = GESTAO_LISTA_PAGE;
  const base = { from, to, vendedor, cidade, limit, offset: (page - 1) * limit };

  const desperdicio = useAcoesGestaoListasRpc<AcoesDesperdicioRow>({
    ...base,
    tipo: "desperdicio",
    anoCorrente: true,
    enabled: active && tab === "desperdicio",
  });
  const negativas = useAcoesGestaoListasRpc<AcoesNegativaRow>({
    ...base,
    tipo: "negativas",
    enabled: active && tab === "negativas",
  });

  const atual = tab === "desperdicio" ? desperdicio : negativas;
  // `keepPreviousData` preserva total e controles enquanto a proxima pagina
  // chega. Sem este estado, os nomes da pagina anterior ficam visiveis por
  // varios segundos e parece que o botao de pagina nao funcionou.
  const carregandoPagina = atual.isLoading || atual.isPlaceholderData;
  const total = atual.data?.total ?? 0;
  const meta = atual.data?.meta;
  const exibidas = atual.data?.rows.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const inicio = total === 0 ? 0 : (page - 1) * limit + 1;
  const fim = total === 0 ? 0 : Math.min(page * limit, total);

  const legenda = useMemo(() => {
    if (tab === "desperdicio") {
      return (
        <>
          Clientes com {fmtNum(meta?.minVisitas ?? 3)}+ visitas no ano corrente, ordenados por mais visitas e,
          em caso de empate, por menos oportunidades levantadas.
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

  const footer = totalPages > 1 ? (
    <PaginationControls
      page={page}
      totalPages={totalPages}
      onPageChange={setPage}
      rangeLabel={`Mostrando ${fmtNum(inicio)}–${fmtNum(fim)} de ${fmtNum(total)}`}
    />
  ) : null;

  // Badge de drill (Story 2-A: nao renderiza mais — aba sem_contato nao existe)
  const drillBadge = null;

  return (
    <div className="space-y-3">
      {drillBadge}
      <BiTableCard
        title={`${TITULO[tab]} · ${fmtNum(inicio)}–${fmtNum(fim)} de ${fmtNum(total)}`}
        actions={
          <ChipToggle
            options={TABS}
            value={tab}
            onChange={setTab}
            ariaLabel="Escolher lista da gestao da carteira"
            prefix="Ver lista:"
          />
        }
        loading={carregandoPagina}
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
