import { useMemo } from "react";
import { DadosComerciais, Filters, Registro } from "@/types/comercial";
import { AlertTriangle, Target } from "lucide-react";
import { BarChart } from "@/components/bi/charts";
import { ChartCard } from "@/components/bi/ChartCard";
import { ClienteCriticoCard } from "@/components/dashboard/ClienteCriticoCard";

interface Props {
  data: DadosComerciais;
  filters: Filters;
}

interface ClienteCritico {
  nome: string;
  cidade: string;
  vendedor: string;
  diasSemContato: number;
  pipeline: number;
  totalAcoes: number;
  visitas: number;
  ultimaData: string;
  ultimaObs: string;
  ultimoTipoAcao: string;
  historico: Registro[];
}

interface SugestaoAcao {
  acao: string;
  argumentacao: string;
  prioridade: "CRÍTICA" | "ALTA" | "MÉDIA";
  borderColor: string;
}

const CARD_BASE =
  "relative overflow-hidden rounded-[20px] p-[22px_24px] bg-gradient-to-b from-[#18160f] to-[#11100d] border border-[rgba(214,207,193,0.08)] shadow-[0_2px_8px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,250,230,0.03)]";

const MONO: React.CSSProperties = {
  fontFamily: "var(--voux-font-mono, 'JetBrains Mono', monospace)",
};

const formatCurrency = (v: number) =>
  v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `R$ ${(v / 1e3).toFixed(0)}K` : `R$ ${v.toFixed(0)}`;

const getSugestaoAcao = (c: ClienteCritico): SugestaoAcao => {
  if (c.diasSemContato > 180 && c.pipeline > 500000) {
    return {
      acao: "Visita presencial urgente + proposta atualizada",
      argumentacao:
        "Resgatar relacionamento com proposta de condições especiais. Mencionar novidades em equipamentos desde o último contato.",
      prioridade: "CRÍTICA",
      borderColor: "#f87171",
    };
  }
  if (c.diasSemContato > 180) {
    return {
      acao: "Ligação de reativação + envio de catálogo atualizado",
      argumentacao:
        "Abordagem consultiva perguntando sobre a safra atual e necessidades futuras. Oferecer demonstração sem compromisso.",
      prioridade: "ALTA",
      borderColor: "#fb923c",
    };
  }
  if (c.pipeline > 500000) {
    return {
      acao: "Contato telefônico + agendamento de visita técnica",
      argumentacao:
        "Reforçar valor do equipamento com ROI projetado. Oferecer condições de financiamento facilitado.",
      prioridade: "ALTA",
      borderColor: "#fb923c",
    };
  }
  return {
    acao: "Contato por WhatsApp/e-mail + follow-up em 7 dias",
    argumentacao:
      "Manter relacionamento ativo. Compartilhar case de sucesso de cliente similar na região.",
    prioridade: "MÉDIA",
    borderColor: "#c8b99a",
  };
};

const FAIXA_COLORS = ["#c8b99a", "#fb923c", "#f87171", "#dc2626"];

export const DashboardClientesCriticos = ({ data, filters }: Props) => {
  const criticos = useMemo(() => {
    const clienteMap = new Map<string, ClienteCritico>();

    for (const v of data.vendedores) {
      if (filters.vendedor && v.nome !== filters.vendedor) continue;
      for (const c of v.topClientes) {
        if (c.diasSemContato < 90) continue;
        if (filters.cidade && c.cidade !== filters.cidade) continue;
        const key = `${c.nome}|${v.nome}`;
        if (!clienteMap.has(key)) {
          const historico = data.registrosRecentes.filter(
            (r) => r.cliente === c.nome && r.vendedor === v.nome
          );
          const ultimoReg = historico[0];
          clienteMap.set(key, {
            nome: c.nome,
            cidade: c.cidade,
            vendedor: v.nome,
            diasSemContato: c.diasSemContato,
            pipeline: c.negocioValor,
            totalAcoes: c.acoes,
            visitas: c.visitas,
            ultimaData: ultimoReg?.dtConclusao || "—",
            ultimaObs: ultimoReg?.obs || "Sem observações registradas",
            ultimoTipoAcao: ultimoReg?.tipoAcao || "—",
            historico,
          });
        }
      }
    }

    let result = Array.from(clienteMap.values());

    if (filters.tipoAcao) {
      result = result.filter((c) => c.historico.some((r) => r.tipoAcao === filters.tipoAcao));
    }

    return result.sort((a, b) => b.pipeline - a.pipeline || b.diasSemContato - a.diasSemContato);
  }, [data, filters]);

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
      {/* Header */}
      <div>
        <p className="text-[10px] tracking-[0.22em] uppercase text-[#8a8273] mb-1" style={MONO}>
          — CLIENTES EM RISCO
        </p>
        <h2 className="text-2xl font-bold text-[#ece5d4] flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-[#c8b99a]" />
          Clientes em Estado Crítico
        </h2>
        <p className="text-[11px] text-[#8a8273] mt-1" style={MONO}>
          Clientes sem contato há mais de 90 dias — ações recomendadas e histórico
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={CARD_BASE} style={{ borderLeft: "3px solid #f87171" }}>
          <p className="text-[10px] tracking-[0.22em] uppercase text-[#8a8273] mb-3" style={MONO}>
            CLIENTES CRÍTICOS
          </p>
          <p className="text-[28px] font-bold leading-none tracking-[-0.02em] text-[#f87171]">
            {criticos.length}
          </p>
          <p className="text-[11px] text-[#8a8273] mt-2" style={MONO}>
            sem contato &gt;90 dias
          </p>
        </div>

        <div className={CARD_BASE} style={{ borderLeft: "3px solid #fb923c" }}>
          <p className="text-[10px] tracking-[0.22em] uppercase text-[#8a8273] mb-3" style={MONO}>
            PIPELINE EM RISCO
          </p>
          <p className="text-[28px] font-bold leading-none tracking-[-0.02em] text-[#fb923c]">
            {formatCurrency(totalPipelineEmRisco)}
          </p>
          <p className="text-[11px] text-[#8a8273] mt-2" style={MONO}>
            valor total em aberto
          </p>
        </div>

        <div className={CARD_BASE} style={{ borderLeft: "3px solid #c8b99a" }}>
          <p className="text-[10px] tracking-[0.22em] uppercase text-[#8a8273] mb-3" style={MONO}>
            MÉDIA DIAS S/ CONTATO
          </p>
          <p className="text-[28px] font-bold leading-none tracking-[-0.02em] text-[#ece5d4]">
            {mediaDias}
          </p>
          <p className="text-[11px] text-[#8a8273] mt-2" style={MONO}>
            dias em média
          </p>
        </div>

        <div className={CARD_BASE} style={{ borderLeft: "3px solid #f87171" }}>
          <p className="text-[10px] tracking-[0.22em] uppercase text-[#8a8273] mb-3" style={MONO}>
            ACIMA DE 180 DIAS
          </p>
          <p className="text-[28px] font-bold leading-none tracking-[-0.02em] text-[#f87171]">
            {acima180}
          </p>
          <p className="text-[11px] text-[#8a8273] mt-2" style={MONO}>
            clientes críticos
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <ChartCard title="Distribuição por Faixa de Inatividade" label="INATIVIDADE" height={220}>
          <BarChart
            data={faixas.map((f) => ({ name: f.name, value: f.value }))}
            layout="vertical"
            keys={["value"]}
            height={220}
            itemColors={FAIXA_COLORS}
          />
        </ChartCard>

        <ChartCard title="Clientes Críticos por Consultor" label="POR CONSULTOR" height={220}>
          <BarChart
            data={porVendedor.map((v) => ({ name: v.vendedor, count: v.count }))}
            layout="horizontal"
            keys={["count"]}
            height={220}
            colors={["#f87171"]}
          />
        </ChartCard>
      </div>

      {/* Critical Clients List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-[#ece5d4] flex items-center gap-2">
          <Target className="h-5 w-5 text-[#c8b99a]" />
          Plano de Ação por Cliente ({criticos.length})
        </h3>

        {criticos.slice(0, 50).map((c) => (
          <ClienteCriticoCard
            key={`${c.nome}|${c.vendedor}`}
            c={c}
            sugestao={getSugestaoAcao(c)}
          />
        ))}

        {criticos.length > 50 && (
          <p className="text-[11px] text-center text-[#8a8273]" style={MONO}>
            Mostrando 50 de {criticos.length} clientes críticos
          </p>
        )}
      </div>
    </div>
  );
};
