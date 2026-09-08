import { useEffect, useRef, useState } from "react";
import { Check, Copy, Database, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { YaChatFilters, YaChatSource, YaMetricDefinition } from "@/services/yaChatService";

type JsonRecord = Record<string, unknown>;

const HIDDEN_KEY = /(cnpj|cpf|email|telefone|phone|documento|clienteid|userid|user_id|id$)/i;
const MAX_PREVIEW_ROWS = 6;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
  if (typeof value === "boolean") return value ? "sim" : "não";
  if (typeof value === "string") return value;
  return "detalhe estruturado";
}

function labelForKey(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ");
}

function previewRows(preview: unknown): JsonRecord[] {
  if (!isRecord(preview)) return [];
  const candidate = Array.isArray(preview.rows)
    ? preview.rows
    : Array.isArray(preview.series)
      ? preview.series
      : Array.isArray(preview.clientes)
        ? preview.clientes
        : Array.isArray(preview.matches)
          ? preview.matches
          : [];
  return candidate.filter(isRecord).slice(0, MAX_PREVIEW_ROWS);
}

function previewColumns(rows: JsonRecord[]): string[] {
  const columns = new Set<string>();
  rows.forEach((row) => Object.keys(row).forEach((key) => columns.add(key)));
  return Array.from(columns).filter((key) => !HIDDEN_KEY.test(key)).slice(0, 5);
}

function PreviewTable({ rows }: { rows: JsonRecord[] }) {
  const columns = previewColumns(rows);
  if (columns.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-[11px]">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>{columns.map((column) => <th key={column} className="px-2 py-1.5 font-medium capitalize">{labelForKey(column)}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${index}-${String(row[columns[0]])}`} className="border-t">
              {columns.map((column) => <td key={column} className="max-w-[9rem] truncate px-2 py-1.5">{formatValue(row[column])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PreviewSummary({ preview }: { preview: unknown }) {
  if (!isRecord(preview)) return null;
  const rows = previewRows(preview);
  if (rows.length > 0) return <PreviewTable rows={rows} />;

  const comparison = ["atual", "anterior"]
    .map((key) => ({ key, value: preview[key] }))
    .filter(({ value }) => isRecord(value));
  if (comparison.length > 0) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {comparison.map(({ key, value }) => {
          const item = value as JsonRecord;
          return <div key={key} className="rounded-lg border bg-muted/20 px-3 py-2"><div className="text-[10px] uppercase text-muted-foreground">{key}</div><div className="font-medium">{formatValue(item.value)}</div><div className="text-[10px] text-muted-foreground">{formatValue(item.unit)}</div></div>;
        })}
      </div>
    );
  }

  const entries = Object.entries(preview).filter(([key, value]) => !HIDDEN_KEY.test(key) && (typeof value !== "object" || value === null)).slice(0, 6);
  if (entries.length === 0) return null;
  return <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">{entries.map(([key, value]) => <div key={key}><dt className="text-muted-foreground capitalize">{labelForKey(key)}</dt><dd className="font-medium">{formatValue(value)}</dd></div>)}</dl>;
}

function scopeFilters(source: YaChatSource): YaChatFilters {
  return source.applied_scope?.filters ?? source.filters ?? {};
}

function metricDefinitions(source: YaChatSource): YaMetricDefinition[] {
  return source.metric_definitions ?? [];
}

function sourceFilterSummary(source: YaChatSource): string {
  const period = source.applied_scope?.period;
  const filters = scopeFilters(source);
  const periodLabel = source.applied_scope?.snapshot
    ? "snapshot atual"
    : period?.from && period.to
      ? `${period.from} a ${period.to}`
      : "período da consulta";
  const extra = [filters.vendedor, filters.cidade, filters.produto, filters.cliente].filter(Boolean).join(" · ");
  return extra ? `${periodLabel} · ${extra}` : periodLabel;
}

export function YaChatEvidence({ sources }: { sources: YaChatSource[] }) {
  const [copiedId, setCopiedId] = useState<string>();
  const timerRef = useRef<number>();

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const copyScope = async (source: YaChatSource) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(source.applied_scope ?? source.filters, null, 2));
      setCopiedId(source.id);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopiedId(undefined), 2_000);
    } catch (error) {
      console.warn("[YaChat] Não foi possível copiar o escopo da evidência.", error);
    }
  };

  if (sources.length === 0) return null;
  return (
    <div className="mt-3 space-y-2 border-t pt-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Evidência e escopo</span>
      {sources.map((source) => {
        const metrics = metricDefinitions(source);
        return (
          <details key={source.id} className="rounded-lg border bg-muted/20 px-3 py-2">
            <summary className="cursor-pointer list-none font-medium text-foreground">{source.label} · {sourceFilterSummary(source)}</summary>
            <div className="mt-2 space-y-2">
              {metrics.map((metric) => <div key={metric.id}><div><span className="font-medium text-foreground">{metric.label}:</span> {metric.definition} <span className="text-muted-foreground">({metric.unit})</span></div><div><span className="font-medium text-foreground">Competência:</span> {metric.competence}. <span className="font-medium text-foreground">Deduplicação:</span> {metric.deduplication}.</div></div>)}
              {source.freshness?.status && <div className="flex items-center gap-1"><Database className="h-3.5 w-3.5" />Frescura: {source.freshness.status}{source.freshness.refreshed_at ? ` · ${source.freshness.refreshed_at}` : ""}</div>}
              {source.warnings?.map((warning) => <div key={warning} className="flex items-start gap-1 text-amber-700 dark:text-amber-300"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{warning}</div>)}
              <PreviewSummary preview={source.preview} />
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => void copyScope(source)}><>{copiedId === source.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}</>{copiedId === source.id ? "Copiado" : "Copiar escopo"}</Button>
                {source.drilldown_ref && <span className="text-[10px]">Detalhe: disponível nesta coorte</span>}
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}
