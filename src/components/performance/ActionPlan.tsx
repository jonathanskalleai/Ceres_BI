import type { Metrics } from "@/hooks/usePerformanceMetrics";

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

export function ActionPlan({ metrics }: { metrics: Metrics }) {
  const actions = [
    {
      titulo: "Revisar todos os negocios em aberto",
      desc: `Existem ${metrics.negociosAbertos} negocios em andamento. Priorize os de maior valor e defina acoes concretas para cada um.`,
      prazo: "Ate sexta-feira",
    },
    {
      titulo: "Atacar clientes com potencial nao convertido",
      desc: `${metrics.clientesPotencial.length} clientes com multiplas interacoes e zero negocio fechado. Agende contato imediato.`,
      prazo: "Proximos 3 dias",
    },
    {
      titulo: "Aumentar taxa de conversao",
      desc: `Taxa atual: ${fmtPct(metrics.taxaConversao)}. Consultores com baixa conversao precisam de acompanhamento intensivo.`,
      prazo: "Continuo",
    },
    {
      titulo: "Concentrar esforco nas regioes de alto potencial",
      desc: `${metrics.regioesOportunidade.length} regioes com alta atividade e baixo fechamento identificadas. Redirecionar foco comercial.`,
      prazo: "Proximos 7 dias",
    },
    {
      titulo: "Reuniao de alinhamento semanal",
      desc: "Apresentar este painel toda segunda-feira. Cobrar metas individuais e definir compromissos semanais.",
      prazo: "Segunda-feira",
    },
  ];

  return (
    <div className="space-y-3">
      {actions.map((a, i) => (
        <div key={i} className="bg-[hsl(222,47%,9%)] border border-[hsl(217,33%,17%)] rounded-lg p-4 flex items-start gap-4">
          <span className="w-8 h-8 rounded-full bg-[hsl(217,91%,60%)] flex items-center justify-center text-sm font-bold text-[hsl(0,0%,100%)] shrink-0">
            {i + 1}
          </span>
          <div className="flex-1">
            <p className="font-bold text-sm">{a.titulo}</p>
            <p className="text-xs text-[hsl(215,16%,57%)] mt-0.5">{a.desc}</p>
          </div>
          <span className="text-xs bg-[hsl(217,33%,17%)] px-2 py-1 rounded whitespace-nowrap">{a.prazo}</span>
        </div>
      ))}
    </div>
  );
}
