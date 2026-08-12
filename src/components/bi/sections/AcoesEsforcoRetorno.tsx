import { useMemo, useState } from "react";
import { BiTableCard } from "@/components/bi/BiTableCard";
import { ChipToggle, type ChipOption } from "@/components/bi/ChipToggle";
import { InlineBar } from "@/components/bi/charts/InlineBar";
import { useAcoesGestaoListasRpc } from "@/hooks/bi/useAcoesGestaoListasRpc";
import { fmtNum, fmtBRL } from "@/lib/formatters";
import { fmtPctOrDash, fmtRatio } from "@/lib/bi/acoesGestaoUtils";
import type { AcoesDesperdicioRow, AcoesRankingConsultorItem } from "@/types/biRpc";

type Modo = "consultor" | "cliente";

const MODO_OPTIONS: readonly ChipOption<Modo>[] = [
  { value: "consultor", label: "Consultor" },
  { value: "cliente", label: "Cliente" },
];

// A RPC aceita ate 2.000 linhas. A tabela usa rolagem, entao nao esconde os
// registros elegiveis atras de um segundo clique.
const CLIENTES_LIMIT = 2_000;

interface Props {
  ranking: AcoesRankingConsultorItem[];
  loading?: boolean;
  error?: Error | null;
  from?: string;
  to?: string;
  vendedor?: string;
  cidade?: string;
  active?: boolean;
}

/**
 * Esforco x Retorno — tabela-ranking com barras embutidas.
 *
 * Substituiu o scatter: os quadrantes eram didaticos ("quem gasta e nao
 * fecha fica no canto"), mas em 4-8 consultores a dispersao ficava rala e o
 * gestor ainda assim pedia "quem e o pior". A tabela ranqueia direto, com
 * a barra dando a dimensao visual que o eixo X provia.
 */
export function AcoesEsforcoRetorno({ ranking, loading, error, from, to, vendedor, cidade, active = true }: Props) {
  const [modo, setModo] = useState<Modo>("consultor");

  const { data: clientes, isLoading: clientesLoading, error: clientesError } =
    useAcoesGestaoListasRpc<AcoesDesperdicioRow>({
      tipo: "desperdicio",
      from,
      to,
      vendedor,
      cidade,
      limit: CLIENTES_LIMIT,
      enabled: active && modo === "cliente",
    });

  const isLoading = modo === "consultor" ? loading : clientesLoading;
  const erroAtual = modo === "consultor" ? error : clientesError;

  return (
    <BiTableCard
      title="Esforco x Retorno"
      loading={isLoading}
      error={erroAtual}
      isEmpty={modo === "consultor" ? ranking.length === 0 : (clientes?.rows ?? []).length === 0}
      emptyMessage="Nenhum dado no periodo"
      actions={
        <ChipToggle
          options={MODO_OPTIONS}
          value={modo}
          onChange={setModo}
          ariaLabel="Alternar entre consultor e cliente"
          prefix="Ver por"
        />
      }
      footer={
        <div className="mt-3 space-y-1 text-[11px] leading-relaxed text-[var(--voux-text-muted)]">
          {modo === "consultor" && (
            <p>
              Taxa de conversao mistura duas origens (visitas por aco_vendedor, ganhos por ngo_vendedores)
              — util para comparar consultores entre si, nao como taxa auditavel.
            </p>
          )}
          {modo === "cliente" && (
            <p>
              Registros como salas de reuniao e rotas internas aparecem no topo do esforco por serem lancados
              como cliente no CRM. Trate-os como ruido de cadastro, nao como cliente improdutivo.
            </p>
          )}
        </div>
      }
    >
      {modo === "consultor"
        ? <ConsultorTable rows={ranking} />
        : <ClienteTable rows={clientes?.rows ?? []} />}
    </BiTableCard>
  );
}

// ─── Sub-component: Consultor table ───────────────────────────────────────────

function ConsultorTable({ rows }: { rows: AcoesRankingConsultorItem[] }) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => {
      // taxaConversao DESC, null last
      const ta = a.taxaConversao ?? -1;
      const tb = b.taxaConversao ?? -1;
      if (tb !== ta) return tb - ta;
      return b.visitas - a.visitas;
    }),
    [rows],
  );

  const maxTaxa = useMemo(() => Math.max(...sorted.map((r) => r.taxaConversao ?? 0), 1), [sorted]);
  return (
    <div className="max-h-[480px] overflow-auto pr-1">
      <table className="w-full text-[12px]" aria-label="Ranking de consultores por esforco x retorno">
        <thead>
          <tr className="text-[var(--voux-text-muted)]" style={HEADER_STYLE}>
            <th className="pb-2 text-left font-medium hidden sm:table-cell w-8">#</th>
            <th className="pb-2 text-left font-medium">Consultor</th>
            <th className="pb-2 text-right font-medium">Visitas</th>
            <th className="pb-2 text-right font-medium hidden sm:table-cell">Oport.</th>
            <th className="pb-2 text-right font-medium">Ganhos</th>
            <th className="pb-2 font-medium w-28 sm:w-36">Taxa Conv.</th>
            <th className="pb-2 text-right font-medium">Valor Ganho</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => {
            const isAlert = r.ganhos === 0 && r.visitas >= 100;
            return (
              <tr
                key={r.consultor}
                className={isAlert ? "bg-[color-mix(in_oklch,var(--voux-danger)_8%,transparent)]" : ""}
              >
                <td className="py-1.5 hidden sm:table-cell text-[var(--voux-text-muted)] tabular-nums">{i + 1}</td>
                <td className="py-1.5 text-[var(--voux-text-primary)] font-medium truncate max-w-[120px]">
                  {isAlert && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--voux-danger)] mr-1.5 align-middle" aria-label="Alerta: esforco sem retorno" />}
                  {r.consultor}
                </td>
                <td className="py-1.5 text-right tabular-nums text-[var(--voux-text-soft)]">{fmtNum(r.visitas)}</td>
                <td className="py-1.5 text-right tabular-nums text-[var(--voux-text-soft)] hidden sm:table-cell">{fmtNum(r.oportunidades)}</td>
                <td className="py-1.5 text-right tabular-nums text-[var(--voux-text-soft)]">{fmtNum(r.ganhos)}</td>
                <td className="py-1.5 px-1"><InlineBar value={r.taxaConversao ?? 0} max={maxTaxa} format={(v) => fmtPctOrDash(v > 0 ? v : null)} /></td>
                <td className="py-1.5 text-right tabular-nums text-[var(--voux-text-soft)]">{fmtBRL(r.valorGanho)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Sub-component: Cliente table ─────────────────────────────────────────────

function ClienteTable({ rows }: { rows: AcoesDesperdicioRow[] }) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.visitas - a.visitas),
    [rows],
  );

  const maxVisitas = useMemo(() => Math.max(...sorted.map((r) => r.visitasPorOportunidade ?? 0), 1), [sorted]);
  return (
    <div className="max-h-[480px] overflow-auto pr-1">
      <table className="w-full text-[12px]" aria-label="Ranking de clientes por esforco x retorno">
        <thead>
          <tr className="text-[var(--voux-text-muted)]" style={HEADER_STYLE}>
            <th className="pb-2 text-left font-medium hidden sm:table-cell w-8">#</th>
            <th className="pb-2 text-left font-medium">Cliente</th>
            <th className="pb-2 text-right font-medium">Visitas</th>
            <th className="pb-2 text-right font-medium hidden sm:table-cell">Acoes</th>
            <th className="pb-2 text-right font-medium">Oport.</th>
            <th className="pb-2 font-medium w-28 sm:w-36">Visitas/Oport.</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => {
            const isAlert = r.oportunidades === 0 && r.visitas >= 10;
            return (
              <tr
                key={`${r.clienteId}-${i}`}
                className={isAlert ? "bg-[color-mix(in_oklch,var(--voux-danger)_8%,transparent)]" : ""}
              >
                <td className="py-1.5 hidden sm:table-cell text-[var(--voux-text-muted)] tabular-nums">{i + 1}</td>
                <td className="py-1.5 text-[var(--voux-text-primary)] font-medium truncate max-w-[140px]">
                  {isAlert && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--voux-danger)] mr-1.5 align-middle" aria-label="Alerta: esforco sem oportunidade" />}
                  {r.cliente ?? r.clienteId}
                </td>
                <td className="py-1.5 text-right tabular-nums text-[var(--voux-text-soft)]">{fmtNum(r.visitas)}</td>
                <td className="py-1.5 text-right tabular-nums text-[var(--voux-text-soft)] hidden sm:table-cell">{fmtNum(r.acoes)}</td>
                <td className="py-1.5 text-right tabular-nums text-[var(--voux-text-soft)]">{fmtNum(r.oportunidades)}</td>
                <td className="py-1.5 px-1"><InlineBar value={r.visitasPorOportunidade ?? 0} max={maxVisitas} format={(v) => fmtRatio(v > 0 ? v : null)} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

const HEADER_STYLE: React.CSSProperties = {
  fontFamily: "var(--voux-font-mono)",
  fontSize: "10px",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};
