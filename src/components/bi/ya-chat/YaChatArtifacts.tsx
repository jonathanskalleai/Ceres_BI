import BarChart from "../charts/BarChart";
import LineChart from "../charts/LineChart";
import { Button } from "@/components/ui/button";
import { formatEvidenceValue } from "@/lib/yaChatFormatters";
import type { YaArtifact, YaChoice } from "@/services/yaChatService";

type JsonRecord = Record<string, unknown>;
const HIDDEN_KEY = /(cpf|cnpj|email|telefone|phone|documento|chassi|serie|userid|user_id|id$)/i;

function safeRows(artifact: YaArtifact): JsonRecord[] {
  return (artifact.rows ?? []).filter((row): row is JsonRecord => typeof row === "object" && row !== null && !Array.isArray(row)).slice(0, 100);
}

function labelFor(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ");
}

function safeChartText(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function displayValue(value: unknown, unit?: string): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return formatEvidenceValue(value, unit);
  if (typeof value === "boolean") return value ? "sim" : "não";
  return String(value).slice(0, 240);
}

function TableArtifact({ artifact }: { artifact: YaArtifact }) {
  const rows = safeRows(artifact);
  const columns = (artifact.columns ?? []).filter((column) => !HIDDEN_KEY.test(column.key)).slice(0, 24);
  const inferred = columns.length > 0 ? columns : Object.keys(rows[0] ?? {}).filter((key) => !HIDDEN_KEY.test(key)).slice(0, 24).map((key) => ({ key, label: labelFor(key) }));
  if (inferred.length === 0) return <p className="text-xs text-muted-foreground">Nenhum detalhe disponível.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">{artifact.title}</caption>
        <thead className="bg-muted/50 text-muted-foreground"><tr>{inferred.map((column) => <th key={column.key} scope="col" className="whitespace-nowrap px-2 py-1.5 font-medium">{column.label}</th>)}</tr></thead>
        <tbody>{rows.map((row, rowIndex) => <tr key={`${rowIndex}-${String(row[inferred[0].key] ?? "")}`} className="border-t">{inferred.map((column) => <td key={column.key} className="max-w-[12rem] truncate px-2 py-1.5">{displayValue(row[column.key])}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function KpiArtifact({ artifact }: { artifact: YaArtifact }) {
  const rows = safeRows(artifact);
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{rows.slice(0, 12).map((row, index) => <div key={`${String(row.label ?? index)}`} className="rounded-lg border bg-muted/20 px-3 py-2"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">{displayValue(row.label ?? row.name)}</div><div className="text-base font-semibold">{displayValue(row.value, typeof row.unit === "string" ? row.unit : undefined)}</div>{row.unit && <div className="text-[10px] text-muted-foreground">{displayValue(row.unit)}</div>}</div>)}</div>;
}

function BarArtifact({ artifact }: { artifact: YaArtifact }) {
  const rows = safeRows(artifact);
  const xKey = artifact.x_key ?? "name";
  const keys = (artifact.series ?? []).map((series) => series.key).filter((key) => !HIDDEN_KEY.test(key));
  const fallback = Object.keys(rows[0] ?? {}).find((key) => key !== xKey && !HIDDEN_KEY.test(key) && typeof rows[0][key] === "number");
  const chartRows = rows.map((row) => ({ name: safeChartText(row[xKey] ?? row.name ?? ""), ...(keys.length > 0 ? Object.fromEntries(keys.map((key) => [key, Number(row[key] ?? 0)])) : fallback ? { [fallback]: Number(row[fallback] ?? 0) } : {}) }));
  const chartKeys = keys.length > 0 ? keys : fallback ? [fallback] : [];
  if (chartRows.length === 0 || chartKeys.length === 0) return <TableArtifact artifact={artifact} />;
  return <><BarChart data={chartRows} keys={chartKeys} seriesLabels={Object.fromEntries((artifact.series ?? []).map((series) => [series.key, safeChartText(series.label)]))} height={220} /><p className="sr-only">Gráfico de barras com {chartRows.length} categorias.</p></>;
}

function LineArtifact({ artifact }: { artifact: YaArtifact }) {
  const rows = safeRows(artifact);
  const xKey = artifact.x_key ?? "name";
  const series = (artifact.series ?? []).filter((item) => !HIDDEN_KEY.test(item.key)).map((item) => ({ name: safeChartText(item.label), data: rows.map((row) => ({ x: safeChartText(row[xKey] ?? row.name ?? ""), y: typeof row[item.key] === "number" ? row[item.key] as number : Number(row[item.key]) || null })) }));
  if (series.length === 0) return <TableArtifact artifact={artifact} />;
  return <><LineChart series={series} height={240} /><p className="sr-only">Gráfico de linha com {series.length} séries e {rows.length} pontos.</p></>;
}

export function YaChatChoices({ choices, onChoice }: { choices: YaChoice[]; onChoice?: (value: string) => void }) {
  if (choices.length === 0) return null;
  return <div className="mt-3 flex flex-wrap gap-2" aria-label="Opções de esclarecimento">{choices.slice(0, 6).map((choice) => <Button key={`${choice.label}-${choice.value}`} type="button" variant="outline" size="sm" onClick={() => onChoice?.(choice.value)}>{choice.label}</Button>)}</div>;
}

export function YaChatArtifacts({ artifacts, choices, onChoice }: { artifacts?: YaArtifact[]; choices?: YaChoice[]; onChoice?: (value: string) => void }) {
  const visible = (artifacts ?? []).filter((artifact) => artifact.type !== "choices").slice(0, 12);
  if (visible.length === 0 && !(choices && choices.length > 0)) return null;
  return <div className="mt-3 space-y-3">{visible.map((artifact, index) => <section key={`${artifact.title}-${index}`} aria-label={artifact.title} className="rounded-lg border bg-background/70 p-3"><h3 className="mb-2 text-xs font-semibold text-foreground">{artifact.title}</h3>{artifact.type === "table" && <TableArtifact artifact={artifact} />}{artifact.type === "kpi_group" && <KpiArtifact artifact={artifact} />}{artifact.type === "bar" && <BarArtifact artifact={artifact} />}{artifact.type === "line" && <LineArtifact artifact={artifact} />}</section>)}<YaChatChoices choices={choices ?? []} onChoice={onChoice} /></div>;
}
