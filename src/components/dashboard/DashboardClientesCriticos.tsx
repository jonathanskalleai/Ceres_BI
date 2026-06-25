import { useMemo } from "react";
import { Target } from "lucide-react";
import { BarChart } from "@/components/bi/charts";
import { ChartCard } from "@/components/bi/ChartCard";
import { ClienteCriticoCard } from "@/components/dashboard/ClienteCriticoCard";
import type { ClienteCriticoView } from "@/pages/crm/CrmCriticos";

interface SugestaoAcao {
  acao: string;
  argumentacao: string;
  prioridade: "CRÍTICA" | "ALTA" | "MÉDIA";
  borderColor: string;
}

interface Props {
  criticos: ClienteCriticoView[];
}

const CARD_BASE =
  "relative overflow-hidden rounded-[20px] p-[22px_24px] border";

const MONO: React.CSSProperties = {
  fontFamily: "var(--voux-font-mono, 'JetBrains Mono', monospace)",
};

const formatCurrency = (v: number) =>
  v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `R$ ${(v / 1e3).toFixed(0)}K` : `R$ ${v.toFixed(0)}`;

const getSugestaoAcao = (c: ClienteCriticoView): SugestaoAcao => {
  if (c.diasSemContato > 180 && c.pipeline > 500000) {
    return {
      acao: "Visita presencial urgente + proposta atualizada",
      argumentacao:
        "Resgatar relacionamento com proposta de condições especiais. Mencionar novidades em equipamentos desde o último contato.",
      prioridade: "CRÍTICA",
      borderColor: "var(--voux-danger)",
    };
  }
  if (c.diasSemContato > 180) {
    return {
      acao: "Ligação de reativação + envio de catálogo atualizado",
      argumentacao:
        "Abordagem consultiva perguntando sobre a safra atual e necessidades futuras. Oferecer demonstração sem compromisso.",
      prioridade: "ALTA",
      borderColor: "var(--voux-warning)",
    };
  }
  if (c.pipeline > 500000) {
    return {
      acao: "Contato telefônico + agendamento de visita técnica",
      argumentacao:
        "Reforçar valor do equipamento com ROI projetado. Oferecer condições de financiamento facilitado.",
      prioridade: "ALTA",
      borderColor: "var(--voux-warning)",
    };
  }
  return {
    acao: "Contato por WhatsApp/e-mail + follow-up em 7 dias",
    argumentacao:
      "Manter relacionamento ativo. Compartilhar case de sucesso de cliente similar na região.",
    prioridade: "MÉDIA",
    borderColor: "var(--voux-accent)",
  };
};

const FAIXA_COLORS = ["var(--voux-accent)", "var(--voux-warning)", "var(--voux-danger)", "#dc2626"];

export const DashboardClientesCriticos = ({ criticos }: Props) => {
  const totalPipelineEmRisco = criticos.reduce((sum, c) => sum + c.pipeline, 0);

  const porVendedor = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of criticos) map.set(c.vendedor, (map.get(c.vendedor) || 0) + 1);
    return Array.from(map.entries())
      .map(([vendedor, count]) => ({ vendedor: vendedor.split(" ").slice(-1)[0], count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [criticos]);

  const faixas = useMemo(() => {
    const f = { "90-120d": 0, "120-180d": 0, "180-365d": 0, ">365d": 0 };
    for (const c of criticos) {
      if (c.diasSemContato > 365) f[">365d"]++;
      else if (c.diasSemContato > 180) f["180-365d"]++;
      else if (c.diasSemContato > 120) f["120-180d"]++;
      else f["90-120d"]++;
    }
    return Object.entries(f).map(([name, value]) => ({ name, value }));
  }, [criticos]);

  const mediaDias =
    criticos.length > 0
      ? Math.round(criticos.reduce((s, c) => s + c.diasSemContato, 0) / criticos.length)
      : 0;
  const acima180 = criticos.filter((c) => c.diasSemContato > 180).length;

  return (
    <div className="p-6 space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="CLIENTES CRÍTICOS" value={criticos.length} sub="sem contato >90 dias" accent="var(--voux-danger)" />
        <KpiCard label="PIPELINE EM RISCO" value={formatCurrency(totalPipelineEmRisco)} sub="valor total em aberto" accent="var(--voux-warning)" />
        <KpiCard label="MÉDIA DIAS S/ CONTATO" value={mediaDias} sub="dias em média" accent="var(--voux-accent)" textColor="var(--voux-text-primary)" />
        <KpiCard label="ACIMA DE 180 DIAS" value={acima180} sub="clientes críticos" accent="var(--voux-danger)" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <ChartCard title="Distribuição por Faixa de Inatividade" label="INATIVIDADE" height={220}>
          <BarChart data={faixas} layout="vertical" keys={["value"]} height={220} itemColors={FAIXA_COLORS} />
        </ChartCard>
        <ChartCard title="Clientes Críticos por Consultor" label="POR CONSULTOR" height={220}>
          <BarChart
            data={porVendedor.map((v) => ({ name: v.vendedor, count: v.count }))}
            layout="horizontal"
            keys={["count"]}
            height={220}
            colors={["#c97565"]}
          />
        </ChartCard>
      </div>

      {/* Critical Clients List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: "var(--voux-text-primary)" }}>
          <Target className="h-5 w-5" style={{ color: "var(--voux-accent)" }} />
          Plano de Ação por Cliente ({criticos.length})
        </h3>

        {criticos.slice(0, 50).map((c) => (
          <ClienteCriticoCard
            key={`${c.nome}|${c.vendedor}`}
            c={{ ...c, historico: [] }}
            sugestao={getSugestaoAcao(c)}
          />
        ))}

        {criticos.length > 50 && (
          <p className="text-[11px] text-center" style={{ ...MONO, color: "var(--voux-text-faint)" }}>
            Mostrando 50 de {criticos.length} clientes críticos
          </p>
        )}
      </div>
    </div>
  );
};

/** Reusable KPI card */
function KpiCard({ label, value, sub, accent, textColor }: {
  label: string;
  value: string | number;
  sub: string;
  accent: string;
  textColor?: string;
}) {
  return (
    <div
      className={CARD_BASE}
      style={{
        background: "linear-gradient(to bottom, var(--voux-card-from), var(--voux-card-to))",
        borderColor: "var(--voux-card-border)",
        boxShadow: "var(--voux-card-shadow)",
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <p className="text-[10px] tracking-[0.22em] uppercase mb-3" style={{ ...MONO, color: "var(--voux-text-faint)" }}>
        {label}
      </p>
      <p className="text-[28px] font-bold leading-none tracking-[-0.02em]" style={{ color: textColor ?? accent }}>
        {value}
      </p>
      <p className="text-[11px] mt-2" style={{ ...MONO, color: "var(--voux-text-faint)" }}>
        {sub}
      </p>
    </div>
  );
}
