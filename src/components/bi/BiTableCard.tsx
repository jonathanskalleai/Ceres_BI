import { type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { isBiDebugEnabled } from "@/components/bi/debug/isBiDebugEnabled";

const CARD = "rounded-xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4";

interface TableSkeletonProps {
  /** Quantidade de linhas fantasma — aproxime do tamanho tipico da tabela. */
  rows?: number;
  rowHeight?: number;
  titleWidth?: number;
}

/**
 * Pulse de carregamento das tabelas de BI.
 *
 * Usa `var(--voux-skeleton)`, NAO `bg-foreground/5`: 5% de opacidade sobre o
 * fundo escuro do tema e visualmente indistinguivel do card, e o sintoma que
 * chega ao usuario e "o grafico veio vazio" quando na verdade esta carregando.
 * Esse defeito ja foi diagnosticado antes no projeto — o `ChartCard` usa a
 * versao correta desde entao, as tabelas e que tinham ficado para tras.
 */
export function TableSkeleton({ rows = 6, rowHeight = 28, titleWidth = 192 }: TableSkeletonProps) {
  return (
    <>
      <Skeleton
        className="rounded mb-3"
        style={{ height: 16, width: titleWidth, background: "var(--voux-skeleton)" }}
      />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="w-full rounded" style={{ height: rowHeight, background: "var(--voux-skeleton)" }} />
        ))}
      </div>
    </>
  );
}

interface BiTableCardProps {
  title: ReactNode;
  /** Slot a direita do titulo (busca, filtro, contador). */
  actions?: ReactNode;
  loading?: boolean;
  /**
   * Erro da query. Renderiza estado de erro EXPLICITO — nunca cai no estado
   * vazio: num BI, dizer "nao houve movimento" quando a consulta falhou e pior
   * que nao mostrar nada, porque o usuario toma decisao em cima da ausencia.
   */
  error?: Error | null;
  isEmpty?: boolean;
  /**
   * Mensagem do estado vazio. Sem ela, um card vazio nao renderiza nada
   * (comportamento das tabelas que somem quando nao ha dado no periodo).
   */
  emptyMessage?: string;
  skeletonRows?: number;
  /** Rodape (paginacao, aviso de truncamento). */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Casca compartilhada das tabelas de BI: card, titulo, skeleton, erro e vazio.
 *
 * Extraida porque as tres tabelas da tela /bi/acoes repetiam o mesmo bloco de
 * card + skeleton (regra dos 3x), e a copia estava divergindo: duas usavam o
 * pulse invisivel no dark e nenhuma tinha estado de erro.
 */
export function BiTableCard({
  title, actions, loading, error, isEmpty, emptyMessage, skeletonRows, footer, children,
}: BiTableCardProps) {
  if (loading) {
    return (
      <div className={CARD}>
        <TableSkeleton rows={skeletonRows} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={CARD}>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--voux-text-muted)] mb-3">{title}</h3>
        <div role="alert" className="flex items-start gap-2 py-4 text-xs text-[var(--voux-text-primary)]">
          <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--voux-danger)]" aria-hidden="true" />
          <div>
            <p className="font-medium">Nao foi possivel carregar estes dados.</p>
            <p className="mt-1 text-[var(--voux-text-muted)]">
              A consulta falhou — o que voce ve abaixo NAO e "nenhum registro no periodo". Recarregue a
              pagina; se persistir, avise o time de dados.
            </p>
            {/* Mesmo gate do BiGestaoErro: `error.message` carrega o prefixo
                [biRpcService.fetchX] e nomes de funcao/parametro de banco —
                reconhecimento de graca para quem estiver do outro lado
                (security-standards #6). Detalhe tecnico so com o BI DEBUG
                ligado; a mensagem amigavel acima e sempre visivel. */}
            {isBiDebugEnabled() && (
              <p className="mt-1 font-mono text-[11px] text-[var(--voux-text-muted)] break-all">{error.message}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isEmpty) {
    if (!emptyMessage) return null;
    return (
      <div className={CARD}>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--voux-text-muted)] mb-3">{title}</h3>
        <p className="py-6 text-center text-xs text-[var(--voux-text-muted)]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={CARD}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--voux-text-muted)]">{title}</h3>
        {actions}
      </div>
      {children}
      {footer}
    </div>
  );
}
