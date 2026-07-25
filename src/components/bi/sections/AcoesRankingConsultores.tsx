import { useMemo, useState } from "react";
import { ChartCard } from "@/components/bi/ChartCard";
import { ChipToggle, type ChipOption } from "@/components/bi/ChipToggle";
import { BiGestaoErro } from "@/components/bi/BiGestaoErro";
import { HorizontalBarChart, type BarChartData } from "@/components/bi/charts";
import { tooltipRow, tooltipTitle } from "@/components/bi/charts/barChartHelpers";
import { CHART_COLORS } from "@/lib/chartTheme";
import { fmtBRL, fmtNum } from "@/lib/formatters";
import {
  sortRanking,
  fmtPctOrDash,
  RANKING_CRITERIOS,
  RANKING_CRITERIO_LABEL,
  type RankingCriterio,
} from "@/lib/bi/acoesGestaoUtils";
import type { AcoesFunilMeta, AcoesRankingConsultorItem } from "@/types/biRpc";

const TOP_N = 12;

const CRITERIO_OPTIONS: readonly ChipOption<RankingCriterio>[] = RANKING_CRITERIOS.map((c) => ({
  value: c,
  label: RANKING_CRITERIO_LABEL[c],
}));

/**
 * Tooltip com os 4 numeros SEMPRE, independente do criterio ordenado. Ver so a
 * metrica escolhida esconde o caso que importa: 615 visitas com 0 fechamentos.
 */
function buildTooltip(datum: BarChartData): string {
  return [
    tooltipTitle(String(datum.name)),
    tooltipRow("Visitas", fmtNum(Number(datum.visitas ?? 0))),
    tooltipRow("Oportunidades", fmtNum(Number(datum.oportunidades ?? 0))),
    tooltipRow("Fechamentos", fmtNum(Number(datum.ganhos ?? 0))),
    tooltipRow("Valor ganho", fmtBRL(Number(datum.valorGanho ?? 0))),
    tooltipRow("Conversao", String(datum.taxaLabel ?? "—")),
    `<div style="margin-top:5px;font-size:9px;color:var(--voux-tooltip-muted);max-width:230px;white-space:normal">Visitas/oportunidades por quem EXECUTOU a acao; fechamentos/valor por quem o negocio PERTENCE.</div>`,
  ].join("");
}

interface Props {
  rows: AcoesRankingConsultorItem[];
  meta: AcoesFunilMeta;
  /** Total de ganhos do funil — a referencia com que a soma do ranking e comparada. */
  ganhosFunil: number;
  loading?: boolean;
  error?: Error | null;
}

/**
 * Ranking de consultores com 4 criterios (pedido 8).
 *
 * O toggle e ordenacao CLIENT-SIDE (`useMemo`): a RPC ja devolveu os 4 numeros
 * por consultor, entao refazer fetch a cada clique seria latencia sem dado novo.
 *
 * "Valor ganho" existe como 4o criterio porque ranking de fechamento com n=4 no
 * topo e ruido estatistico — a ordem muda com um unico negocio.
 */
export function AcoesRankingConsultores({ rows, meta, ganhosFunil, loading, error }: Props) {
  const [criterio, setCriterio] = useState<RankingCriterio>("visitas");

  const data = useMemo<BarChartData[]>(
    () =>
      sortRanking(rows, criterio, TOP_N).map((r) => ({
        name: r.consultor,
        valor: r[criterio],
        visitas: r.visitas,
        oportunidades: r.oportunidades,
        ganhos: r.ganhos,
        valorGanho: r.valorGanho,
        taxaLabel: fmtPctOrDash(r.taxaConversao),
      })),
    [rows, criterio],
  );

  const isValor = criterio === "valorGanho";
  const diffGanhos = ganhosFunil - meta.somaGanhosRanking;

  // Grafico vazio por falha de consulta leria como "ninguem produziu no periodo".
  if (!loading && error) {
    return (
      <ChartCard title="Ranking de Consultores" height={120}>
        <BiGestaoErro error={error} contexto="o ranking de consultores" />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Ranking de Consultores"
      description={`Top ${TOP_N} · ordenado por ${RANKING_CRITERIO_LABEL[criterio].toLowerCase()}`}
      dataSource="rpc_acoes_funil_gestao · rankingConsultores · atribuicao hibrida (visitas/oportunidades por aco_vendedor; fechamentos/valor por ngo_vendedores→usuarios)"
      /* 12 linhas x (26px de barra + 8px de gap) — menos que isto corta o rodape do ranking */
      height={430}
      loading={loading}
      actions={
        <ChipToggle
          options={CRITERIO_OPTIONS}
          value={criterio}
          onChange={setCriterio}
          ariaLabel="Ordenar ranking de consultores por criterio"
          prefix="Ordenar"
        />
      }
      footer={
        <div className="space-y-1 text-[11px] leading-relaxed text-[var(--voux-text-muted)]">
          <p>
            <strong className="text-[var(--voux-text-primary)]">Origens diferentes:</strong> visitas e
            oportunidades sao atribuidas a quem <em>executou</em> a acao (<code>aco_vendedor</code>);
            fechamentos e valor, a quem o negocio <em>pertence</em> (<code>ngo_vendedores</code>). Por isso a
            coluna de conversao mistura as duas origens e serve para comparar consultores entre si, nao como
            taxa auditavel.
          </p>
          {diffGanhos !== 0 && (
            <p>
              <strong className="text-[var(--voux-text-primary)]">A soma nao fecha, e esperado:</strong> o
              ranking soma {fmtNum(meta.somaGanhosRanking)} fechamentos contra {fmtNum(ganhosFunil)} do funil
              — {fmtNum(meta.ganhosSemAtribuicao)} ganho(s) nao tem consultor atribuido no negocio e nao
              aparece(m) em nenhuma linha.
            </p>
          )}
          {meta.acoesSemConsultor > 0 && (
            <p>
              {fmtNum(meta.acoesSemConsultor)} acao(oes) do periodo estao sem consultor preenchido e ficaram
              fora do ranking (nao viram linha em branco).
            </p>
          )}
        </div>
      }
    >
      <HorizontalBarChart
        data={data}
        keys={["valor"]}
        seriesLabels={{ valor: RANKING_CRITERIO_LABEL[criterio] }}
        title=""
        colors={[isValor ? CHART_COLORS[1] : CHART_COLORS[0]]}
        tooltipFormatter={(v) => (isValor ? fmtBRL(v) : fmtNum(v))}
        tooltipContentFormatter={(datum) => buildTooltip(datum)}
      />
    </ChartCard>
  );
}
