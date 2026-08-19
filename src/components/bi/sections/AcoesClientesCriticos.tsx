import { AlertTriangle, ArrowRight, CircleDollarSign } from "lucide-react";
import { Link } from "react-router-dom";
import { BiTableCard } from "@/components/bi/BiTableCard";
import { fmtBRLKpi } from "@/lib/formatters";
import type { RpcClientesCriticosBI } from "@/types/biRpc";

interface Props {
  data?: RpcClientesCriticosBI;
  loading?: boolean;
  error?: Error | null;
}

export function AcoesClientesCriticos({ data, loading, error }: Props) {
  const total = data?.totalCriticos ?? 0;
  const semAcao = data?.semAcaoRegistrada ?? 0;
  const valorEmRisco = data?.valorEmRisco ?? 0;
  const rows = data?.rows ?? [];

  return (
    <BiTableCard
      title={
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[var(--voux-danger)]" aria-hidden="true" />
          Clientes críticos
        </span>
      }
      loading={loading}
      error={error}
      isEmpty={!loading && !error && total === 0}
      emptyMessage="Nenhum cliente com mais de 365 dias sem ação registrada neste recorte."
      skeletonRows={4}
      actions={
        <Link to="/crm/registros" className="inline-flex items-center gap-1 text-xs text-[var(--voux-accent)] hover:underline">
          Ver atividades <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      }
    >
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--voux-danger)]/25 bg-[var(--voux-danger)]/[0.05] px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--voux-text-muted)]">Sem ação há mais de 365 dias</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--voux-danger)]">{total.toLocaleString("pt-BR")}</p>
          {semAcao > 0 && <p className="mt-1 text-[11px] text-[var(--voux-text-muted)]">{semAcao.toLocaleString("pt-BR")} sem nenhuma ação registrada desde o cadastro</p>}
        </div>
        <div className="rounded-lg border border-[var(--voux-card-border)] px-3 py-2">
          <p className="flex items-center gap-1 text-[11px] uppercase tracking-[0.1em] text-[var(--voux-text-muted)]"><CircleDollarSign className="h-3.5 w-3.5" /> Carteira aberta associada</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--voux-text-heading)]">{fmtBRLKpi(valorEmRisco)}</p>
          <p className="mt-1 text-[11px] text-[var(--voux-text-muted)]">Negócios em andamento, sem Repasse de Máquina</p>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((item) => (
          <div key={String(item.clienteId)} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-black/[0.02] px-3 py-2 text-sm dark:bg-white/[0.03]">
            <div>
              <p className="font-medium text-[var(--voux-text-primary)]">{item.cliente}</p>
              <p className="text-[11px] text-[var(--voux-text-muted)]">{[item.consultor, item.cidade].filter(Boolean).join(" · ") || "Sem consultor/cidade"}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-xs text-[var(--voux-danger)]">{item.diasSemAcao.toLocaleString("pt-BR")} dias</p>
              <p className="text-[11px] text-[var(--voux-text-muted)]">{item.semAcaoRegistrada ? "Sem ação registrada" : fmtBRLKpi(item.valorEmRisco)}</p>
            </div>
          </div>
        ))}
      </div>
    </BiTableCard>
  );
}
