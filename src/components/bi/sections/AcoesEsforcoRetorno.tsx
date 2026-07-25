import { useMemo, useState } from "react";
import { ChartCard } from "@/components/bi/ChartCard";
import { ChipToggle, type ChipOption } from "@/components/bi/ChipToggle";
import { BiGestaoErro } from "@/components/bi/BiGestaoErro";
import { ScatterChart, type ScatterPoint } from "@/components/bi/charts";
import { useAcoesGestaoListasRpc } from "@/hooks/bi/useAcoesGestaoListasRpc";
import { fmtNum } from "@/lib/formatters";
import { fmtRatio } from "@/lib/bi/acoesGestaoUtils";
import type { AcoesDesperdicioRow, AcoesRankingConsultorItem } from "@/types/biRpc";

type Modo = "consultor" | "cliente";

const MODO_OPTIONS: readonly ChipOption<Modo>[] = [
  { value: "consultor", label: "Consultor" },
  { value: "cliente", label: "Cliente" },
];

/** Teto de pontos do modo cliente — o scatter satura muito antes disso. */
const CLIENTES_LIMIT = 300;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

function tooltipLinha(label: string, valor: string): string {
  return `<div style="display:flex;justify-content:space-between;gap:14px"><span style="color:var(--voux-tooltip-muted)">${label}</span><span>${valor}</span></div>`;
}

interface Props {
  ranking: AcoesRankingConsultorItem[];
  loading?: boolean;
  /** Erro da RPC de agregados (alimenta o modo `consultor`). */
  error?: Error | null;
  from?: string;
  to?: string;
  vendedor?: string;
  cidade?: string;
  /** A secao inteira so busca quando a aba /bi/acoes esta ativa. */
  active?: boolean;
}

/**
 * Esforco x Retorno (pedidos 3 e 5 consolidados num unico grafico).
 *
 * Duas tabelas ("so visita e nao fecha" + "muitas visitas, poucas
 * oportunidades") mostrariam os mesmos numeros em linhas separadas, onde
 * ninguem cruza os eixos. No quadrante, quem gasta esforco sem retorno fica no
 * canto inferior direito e salta sozinho.
 *
 * O modo `cliente` so busca a lista quando selecionado (`enabled`): sao ate
 * 300 linhas que a maioria dos acessos nunca vai olhar.
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

  const pontos = useMemo<ScatterPoint[]>(() => {
    if (modo === "consultor") {
      return ranking.map((r) => ({
        label: r.consultor,
        x: r.visitas,
        y: r.ganhos,
        // esforco alto sem NENHUM retorno e o caso que o grafico existe para achar
        highlight: r.ganhos === 0 && r.visitas >= 100,
      }));
    }
    return (clientes?.rows ?? []).map((c) => ({
      label: c.cliente ?? c.clienteId,
      x: c.visitas,
      y: c.oportunidades,
      highlight: c.oportunidades === 0 && c.visitas >= 10,
    }));
  }, [modo, ranking, clientes]);

  const tooltipContent = useMemo(() => {
    if (modo === "consultor") {
      const byName = new Map(ranking.map((r) => [r.consultor, r]));
      return (p: ScatterPoint) => {
        const r = byName.get(p.label);
        return [
          `<div style="font-size:12px;margin-bottom:5px"><strong>${escapeHtml(p.label)}</strong></div>`,
          tooltipLinha("Visitas", fmtNum(p.x)),
          tooltipLinha("Fechamentos", fmtNum(p.y)),
          tooltipLinha("Oportunidades", fmtNum(r?.oportunidades ?? 0)),
        ].join("");
      };
    }
    const byName = new Map((clientes?.rows ?? []).map((c) => [c.cliente ?? c.clienteId, c]));
    return (p: ScatterPoint) => {
      const c = byName.get(p.label);
      return [
        `<div style="font-size:12px;margin-bottom:5px"><strong>${escapeHtml(p.label)}</strong></div>`,
        tooltipLinha("Visitas", fmtNum(p.x)),
        tooltipLinha("Oportunidades", fmtNum(p.y)),
        tooltipLinha("Acoes totais", fmtNum(c?.acoes ?? 0)),
        tooltipLinha("Visitas/oport.", fmtRatio(c?.visitasPorOportunidade ?? null)),
      ].join("");
    };
  }, [modo, ranking, clientes]);

  const isLoading = modo === "consultor" ? loading : clientesLoading;
  const erroAtual = modo === "consultor" ? error : clientesError;
  const semRetorno = pontos.filter((p) => p.highlight).length;

  // Scatter vazio por falha de consulta leria como "ninguem gastou esforco".
  if (!isLoading && erroAtual) {
    return (
      <ChartCard title="Esforco x Retorno" height={120}>
        <BiGestaoErro error={erroAtual} contexto="a dispersao de esforco x retorno" />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Esforco x Retorno"
      description={
        modo === "consultor"
          ? "Cada ponto e um consultor · visitas x fechamentos"
          : `Cada ponto e um cliente com 3+ visitas · visitas x oportunidades (top ${CLIENTES_LIMIT})`
      }
      dataSource={
        modo === "consultor"
          ? "rpc_acoes_funil_gestao · rankingConsultores"
          : "rpc_acoes_gestao_listas · p_tipo = desperdicio (>= 3 visitas no periodo)"
      }
      height={320}
      loading={isLoading}
      actions={
        <ChipToggle
          options={MODO_OPTIONS}
          value={modo}
          onChange={setModo}
          ariaLabel="Alternar a unidade do grafico esforco x retorno"
          prefix="Ver por"
        />
      }
      footer={
        <div className="space-y-1 text-[11px] leading-relaxed text-[var(--voux-text-muted)]">
          <p>
            Canto inferior direito = esforco alto, retorno zero
            {semRetorno > 0 && <> · {fmtNum(semRetorno)} destacado(s) em vermelho</>}. O eixo vertical usa a
            mesma janela do funil: negocio com ciclo de 6 a 18 meses pode ainda nao ter fechado.
          </p>
          {modo === "cliente" && (
            <p>
              A lista nao filtra cadastro: registros como salas de reuniao e rotas internas aparecem no topo
              do esforco por serem lancados como cliente no CRM. Trate-os como ruido de cadastro, nao como
              cliente improdutivo.
            </p>
          )}
        </div>
      }
    >
      <ScatterChart
        data={pontos}
        xLabel={modo === "consultor" ? "Visitas" : "Visitas ao cliente"}
        yLabel={modo === "consultor" ? "Fechamentos" : "Oportunidades"}
        height={320}
        tooltipContent={tooltipContent}
        ariaLabel={`Dispersao de esforco por retorno, por ${modo}`}
      />
    </ChartCard>
  );
}
