import { Fragment, useState } from "react";
import { Database, Activity, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { KPICard } from "@/components/bi/KPICard";
import { Badge } from "@/components/ui/badge";
import { EtlHistoryPanel } from "@/components/bi/EtlHistoryPanel";
import { useEtlStatus } from "@/hooks/bi/useEtlStatus";
import type { EtlSyncStatus } from "@/types/biRpc";

function FreshnessBadge({ minutes, hasError }: { minutes: number; hasError: boolean }) {
  if (hasError) {
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">erro</Badge>;
  }
  if (minutes < 120) {
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">ok</Badge>;
  }
  if (minutes < 1440) {
    return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">atencao</Badge>;
  }
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">stale</Badge>;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function SyncTable({ tables }: { tables: EtlSyncStatus[] }) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--voux-card-border)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr
            className="text-left text-[11px] uppercase tracking-wider"
            style={{ fontFamily: "var(--voux-font-label)", color: "var(--voux-label)", background: "var(--surface-raised)" }}
          >
            <th className="px-4 py-3 w-10">Histórico</th>
            <th className="px-4 py-3">Tabela</th>
            <th className="px-4 py-3">View Origem</th>
            <th className="px-4 py-3 text-right">Registros</th>
            <th className="px-4 py-3">Ultima Sync</th>
            <th className="px-4 py-3">Freshness</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {tables.map((row) => {
            const isExpanded = expandedRow === row.table_name;
            return (
              <Fragment key={row.table_name}>
                <tr
                  onClick={() => setExpandedRow(isExpanded ? null : row.table_name)}
                  className="border-t cursor-pointer transition-colors hover:bg-[var(--surface-raised)]"
                  style={{ borderColor: "var(--voux-card-border)" }}
                  aria-expanded={isExpanded}
                >
                  <td className="px-4 py-2.5" style={{ color: "var(--voux-text-muted)" }}>
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </td>
                  <td className="px-4 py-2.5 font-medium" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-heading)" }}>
                    {row.table_name}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--voux-text-muted)" }}>
                    {row.source_view}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: "var(--voux-text-soft)" }}>
                    {row.rows_synced?.toLocaleString("pt-BR") ?? "—"}
                  </td>
                  <td className="px-4 py-2.5" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-soft)" }}>
                    {formatDate(row.last_sync_at)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <FreshnessBadge minutes={row.minutes_since_sync} hasError={!!row.error_message} />
                      <span className="text-[11px] tabular-nums" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}>
                        {formatMinutes(row.minutes_since_sync)}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {row.error_message ? (
                      <span className="text-xs text-red-400 truncate max-w-[200px] inline-block" title={row.error_message}>
                        {row.error_message}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--voux-text-muted)" }}>{row.status}</span>
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  <tr style={{ borderColor: "var(--voux-card-border)" }}>
                    <td colSpan={7} className="p-0" style={{ background: "var(--surface-raised)" }}>
                      <EtlHistoryPanel tableName={row.table_name} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function BiEtlMonitor() {
  const { tables, isLoading } = useEtlStatus();

  const totalTables = tables.length;
  const allHealthy = tables.every((t) => !t.error_message && t.minutes_since_sync < 1440);
  const lastSyncGlobal = tables.length > 0 ? tables[0].last_sync_at : null;

  return (
    <section className="p-8 space-y-6" style={{ background: "var(--voux-bg)" }}>
      {/* KPI row */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
        <KPICard title="Tabelas Mirror" value={totalTables} icon={Database} loading={isLoading} />
        <KPICard
          title="Saude Geral"
          value={allHealthy ? "OK" : "Atencao"}
          icon={allHealthy ? CheckCircle2 : AlertTriangle}
          loading={isLoading}
          accentColor={allHealthy ? "var(--voux-success, #4ade80)" : "var(--voux-danger, #f87171)"}
        />
        <KPICard
          title="Ultima Sync"
          value={lastSyncGlobal ? formatDate(lastSyncGlobal) : "—"}
          icon={Activity}
          loading={isLoading}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-champagne-400 border-t-transparent" />
        </div>
      ) : (
        <SyncTable tables={tables} />
      )}
    </section>
  );
}
