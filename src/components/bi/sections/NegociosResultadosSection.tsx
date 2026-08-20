import { AlertTriangle, BriefcaseBusiness, CalendarClock, CircleX, Flame, Target, Trophy, Wallet } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { BiErrorState } from "@/components/bi/BiErrorState";
import { ChartCard } from "@/components/bi/ChartCard";
import { KPICard } from "@/components/bi/KPICard";
import { LineChart } from "@/components/bi/charts";
import { useResultadosNegociosBIRpc } from "@/hooks/bi/useResultadosNegociosBIRpc";
import { CHART_COLORS, NEGATIVE_COLOR, POSITIVE_COLOR } from "@/lib/chartTheme";
import { formatBRL, formatDateBR, formatMonthYear, toISODate } from "@/lib/dateUtils";
import { fmtBRLKpi } from "@/lib/formatters";
import type { ResultadosNegociosSaudeCarteira, ResultadosNegociosValorItem, RpcResultadosNegociosBI } from "@/types/biRpc";

interface Props {
  active: boolean;
  dateRange?: DateRange;
  vendedor?: string;
  cidade?: string;
}

const EMPTY_SAUDE: ResultadosNegociosSaudeCarteira = {
  abertos: 0,
  semAcao15Dias: 0,
  valorSemAcao15Dias: 0,
  semPrevisao: 0,
  valorSemPrevisao: 0,
  quentes: 0,
  valorQuentes: 0,
};

const EMPTY_AGG: RpcResultadosNegociosBI = {
  kpis: {
    pedidosGanhos: 0,
    valorGanho: 0,
    negociosPerdidos: 0,
    valorPerdido: 0,
    pipelineGeradoAberto: 0,
    valorPipelineGeradoAberto: 0,
    carteiraAtivaTrabalhada: 0,
    valorCarteiraAtivaTrabalhada: 0,
  },
  funilPorEtapa: [],
  projecaoAnual: [],
  saudeCarteira: EMPTY_SAUDE,
  prioridadesFechamento: [],
  motivosPerda: [],
};

function stars(estrelas: number) {
  return `${"★".repeat(estrelas)}${"☆".repeat(5 - estrelas)}`;
}

function ListaDeValores({
  dados,
  color,
  unidade = "negócios",
}: {
  dados: ResultadosNegociosValorItem[];
  color: string;
  unidade?: string;
}) {
  const max = Math.max(...dados.map((item) => item.valor), 1);

  return (
    <div className="space-y-3 overflow-y-auto pr-1">
      {dados.map((item) => (
        <div key={item.name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium text-[var(--voux-text-primary)]" title={item.name}>{item.name}</p>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--voux-card-border)]">
              <div className="h-full rounded-full" style={{ width: `${(item.valor / max) * 100}%`, background: color }} />
            </div>
          </div>
          <div className="text-right tabular-nums">
            <p className="text-[13px] font-semibold text-[var(--voux-text-primary)]" title={formatBRL(item.valor)}>{fmtBRLKpi(item.valor)}</p>
            <p className="text-[10px] text-[var(--voux-text-muted)]">{item.negocios} {unidade}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SaudeCard({
  title,
  quantidade,
  valor,
  detalhe,
  icon: Icon,
  tone,
}: {
  title: string;
  quantidade: number;
  valor: number;
  detalhe: string;
  icon: typeof AlertTriangle;
  tone: "danger" | "warning" | "success";
}) {
  const colors = {
    danger: "var(--voux-danger)",
    warning: "var(--voux-warning)",
    success: "var(--voux-success)",
  } as const;
  const color = colors[tone];

  return (
    <article
      className="rounded-xl border p-4"
      style={{
        borderColor: `color-mix(in srgb, ${color} 35%, var(--voux-card-border))`,
        background: `color-mix(in srgb, ${color} 7%, var(--surface-raised))`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--voux-text-muted)]">{title}</p>
        <Icon className="h-4 w-4 shrink-0" style={{ color }} />
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold tabular-nums text-[var(--voux-text-primary)]">{quantidade.toLocaleString("pt-BR")}</p>
      <p className="mt-1 text-[12px] font-medium text-[var(--voux-text-primary)]" title={formatBRL(valor)}>{fmtBRLKpi(valor)}</p>
      <p className="mt-2 text-[11px] leading-snug text-[var(--voux-text-muted)]">{detalhe}</p>
    </article>
  );
}

/**
 * Visão de gestão, não outra tela de pedidos: resultado no período, trajetória
 * anual e oportunidades a agir agora a partir de negócio + pedido + ação.
 */
export default function NegociosResultadosSection({ active, dateRange, vendedor, cidade }: Props) {
  const from = toISODate(dateRange?.from) ?? "2000-01-01";
  const to = toISODate(dateRange?.to ?? dateRange?.from) ?? toISODate(new Date())!;
  const { data: agg = EMPTY_AGG, isLoading, error, refetch } = useResultadosNegociosBIRpc({
    from,
    to,
    vendedor,
    cidade,
    enabled: active,
  });
  const { kpis, saudeCarteira } = agg;

  if (error) {
    return (
      <BiErrorState
        message="Não foi possível carregar a visão de Negócios & Funil. Tente novamente; se persistir, informe o erro ao suporte."
        onRetry={() => void refetch()}
      />
    );
  }

  const etapas = agg.funilPorEtapa.slice(0, 8);
  const maiorEtapa = Math.max(...etapas.map((item) => item.valor), 1);

  return (
    <div className="space-y-6 pt-4">
      <p className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
        <strong className="text-foreground">Resultado conciliado:</strong>{" "}
        ganho usa pedido aprovado; perda usa negócio fechado; Repasse de Máquina fica fora. Abaixo, a junção com ações identifica o que precisa de decisão agora.
      </p>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <KPICard title="Pedidos Ganhos" value={kpis.pedidosGanhos.toLocaleString("pt-BR")} icon={Trophy} loading={isLoading}
          hint={`${fmtBRLKpi(kpis.valorGanho)} aprovados no período`} rawValue={kpis.valorGanho} />
        <KPICard title="Valor Ganho" value={fmtBRLKpi(kpis.valorGanho)} icon={Wallet} accentColor="success" loading={isLoading}
          hint={`${kpis.pedidosGanhos.toLocaleString("pt-BR")} pedidos aprovados`} rawValue={kpis.valorGanho} />
        <KPICard title="Negócios Perdidos" value={kpis.negociosPerdidos.toLocaleString("pt-BR")} icon={CircleX} accentColor="danger" loading={isLoading}
          hint={`${fmtBRLKpi(kpis.valorPerdido)} em valor potencial`} rawValue={kpis.valorPerdido} />
        <KPICard title="Valor Perdido" value={fmtBRLKpi(kpis.valorPerdido)} icon={CircleX} accentColor="danger" loading={isLoading}
          hint={`${kpis.negociosPerdidos.toLocaleString("pt-BR")} negócios fechados no período`} rawValue={kpis.valorPerdido} />
        <KPICard title="Pipeline Gerado e Aberto" value={fmtBRLKpi(kpis.valorPipelineGeradoAberto)} icon={BriefcaseBusiness} loading={isLoading}
          hint={`${kpis.pipelineGeradoAberto.toLocaleString("pt-BR")} oportunidades entraram em VENDAS e seguem abertas`} rawValue={kpis.valorPipelineGeradoAberto} />
        <KPICard title="Carteira Ativa Trabalhada" value={fmtBRLKpi(kpis.valorCarteiraAtivaTrabalhada)} icon={BriefcaseBusiness} loading={isLoading}
          hint={`${kpis.carteiraAtivaTrabalhada.toLocaleString("pt-BR")} negócios abertos com ação concluída no período`} rawValue={kpis.valorCarteiraAtivaTrabalhada} />
      </div>

      <ChartCard
        title="Trajetória de Receita e Cenários de Fechamento"
        description="Realizado acumulado: pedidos aprovados de janeiro até hoje. Os três cenários partem desse realizado e projetam as oportunidades abertas com previsão para os meses restantes: conservador (−1 estrela), provável (CRM) e otimista (+1 estrela)."
        loading={isLoading}
        height={340}
        actions={<span className="rounded-full border border-[var(--voux-card-border)] px-2 py-1 text-[10px] font-mono uppercase text-[var(--voux-text-muted)]">ano corrente</span>}
      >
        <LineChart
          series={[
            { name: "Realizado acumulado", color: POSITIVE_COLOR, data: agg.projecaoAnual.map((item) => ({ x: formatMonthYear(item.name), y: item.realizadoAcumulado })) },
            { name: "Conservador", color: NEGATIVE_COLOR, dashed: true, data: agg.projecaoAnual.map((item) => ({ x: formatMonthYear(item.name), y: item.cenarioConservador })) },
            { name: "Provável", color: CHART_COLORS[0], data: agg.projecaoAnual.map((item) => ({ x: formatMonthYear(item.name), y: item.cenarioProvavel })) },
            { name: "Otimista", color: CHART_COLORS[4], dashed: true, data: agg.projecaoAnual.map((item) => ({ x: formatMonthYear(item.name), y: item.cenarioOtimista })) },
          ]}
          height={340}
          area={false}
          showValues={false}
          tooltipFormatter={formatBRL}
        />
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Funil Atual — Onde está a Carteira Trabalhada"
          description="Etapa atual dos negócios em andamento que receberam ação concluída no período. O valor é sempre contabilizado uma vez por negócio."
          loading={isLoading}
          height={Math.max(260, Math.min(390, etapas.length * 46 + 26))}
        >
          <div className="space-y-3 overflow-y-auto pr-1">
            {etapas.map((item) => (
              <div key={item.name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
                <div className="min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[12px] font-medium text-[var(--voux-text-primary)]" title={item.name}>{item.name}</p>
                    <span className="shrink-0 text-[10px] text-[var(--voux-text-muted)]">{item.negocios} negócios</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--voux-card-border)]">
                    <div className="h-full rounded-full bg-[var(--voux-accent)]" style={{ width: `${(item.valor / maiorEtapa) * 100}%` }} />
                  </div>
                </div>
                <p className="self-end text-right text-[13px] font-semibold tabular-nums text-[var(--voux-text-primary)]" title={formatBRL(item.valor)}>{fmtBRLKpi(item.valor)}</p>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard
          title="Fila de Fechamento — Próximas Decisões"
          description="Negócios abertos ordenados por probabilidade, previsão de fechamento e valor. Cliente e produto vêm do negócio; dias sem ação vêm do histórico de ações."
          loading={isLoading}
          height={Math.max(260, Math.min(390, agg.prioridadesFechamento.length * 58 + 8))}
        >
          <div className="space-y-2 overflow-y-auto pr-1" role="list" aria-label="Prioridades de fechamento">
            {agg.prioridadesFechamento.map((item) => (
              <article key={item.negocio} role="listitem" className="grid grid-cols-[58px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[var(--voux-card-border)] bg-[var(--surface-raised)] px-3 py-2.5">
                <span className="text-[12px]" style={{ color: item.estrelas >= 4 ? "var(--voux-success)" : "var(--voux-warning)" }} title={`${item.estrelas} de 5 estrelas`}>
                  {stars(item.estrelas)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-[var(--voux-text-primary)]" title={item.cliente}>{item.cliente}</p>
                  <p className="truncate text-[10px] text-[var(--voux-text-muted)]" title={`${item.produto} · ${item.etapa}`}>{item.produto} · {item.etapa}</p>
                </div>
                <div className="text-right tabular-nums">
                  <p className="text-[12px] font-semibold text-[var(--voux-text-primary)]" title={formatBRL(item.valor)}>{fmtBRLKpi(item.valor)}</p>
                  <p className="text-[10px] text-[var(--voux-text-muted)]" title={item.previsao ? formatDateBR(item.previsao) : "Sem previsão"}>
                    {item.previsao ? formatDateBR(item.previsao) : "sem previsão"}{item.diasSemAcao == null ? "" : ` · ${item.diasSemAcao}d`}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </ChartCard>
      </div>

      <section aria-label="Saúde da carteira">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div>
            <h2 className="text-[15px] font-medium text-[var(--voux-text-heading)]">Saúde da Carteira</h2>
            <p className="text-[11px] text-[var(--voux-text-muted)]">{saudeCarteira.abertos.toLocaleString("pt-BR")} oportunidades monitoradas: previsão recente/futura ou ação nos últimos 90 dias.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SaudeCard title="Sem ação recente" quantidade={saudeCarteira.semAcao15Dias} valor={saudeCarteira.valorSemAcao15Dias}
            detalhe="Sem ação concluída nos últimos 15 dias: carteira a recuperar." icon={AlertTriangle} tone="danger" />
          <SaudeCard title="Sem previsão" quantidade={saudeCarteira.semPrevisao} valor={saudeCarteira.valorSemPrevisao}
            detalhe="Sem data estimada de fechamento: previsão comercial incompleta." icon={CalendarClock} tone="warning" />
          <SaudeCard title="Oportunidades quentes" quantidade={saudeCarteira.quentes} valor={saudeCarteira.valorQuentes}
            detalhe="Probabilidade CRM de 4 ou 5 estrelas: priorize a próxima ação." icon={Flame} tone="success" />
        </div>
      </section>

      <ChartCard
        title="Diagnóstico das Perdas"
        description="Motivos dos negócios fechados como perdidos no período selecionado, ordenados pelo valor potencial perdido."
        loading={isLoading}
      >
        <ListaDeValores dados={agg.motivosPerda} color={NEGATIVE_COLOR} />
      </ChartCard>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Target className="h-3.5 w-3.5" />
        Período, vendedor e cidade filtram resultado, funil e perdas. A trajetória anual mantém o ano corrente para comparar realizado e previsão na mesma escala.
      </p>
    </div>
  );
}
