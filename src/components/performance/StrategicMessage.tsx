import type { Metrics } from "@/hooks/usePerformanceMetrics";

const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function StrategicMessage({ metrics, metaAnual }: { metrics: Metrics; metaAnual: number }) {
  const gap = metrics.gap;
  const mesesRestantes = metrics.mesesRestantes;
  const pct = metrics.pctAtingido;
  const proj = metrics.projecaoAnual;

  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <p className="text-lg font-bold text-[hsl(0,84%,60%)]">
        ATENCAO, TIME COMERCIAL
      </p>
      <p>
        Estamos com <strong>{fmtPct(pct)}</strong> da meta anual realizada. Faltam <strong>{fmt(gap)}</strong> para atingir a meta.
      </p>
      <p>
        No ritmo atual, a projecao de fechamento e de <strong>{fmt(proj)}</strong> — {proj >= metaAnual
          ? <span className="text-[hsl(152,69%,40%)] font-bold">estamos no caminho certo.</span>
          : <span className="text-[hsl(0,84%,60%)] font-bold">NAO atingiremos a meta.</span>
        }
      </p>
      <p>
        Temos <strong>{mesesRestantes} meses</strong> restantes. Cada dia sem resultado e um dia mais perto de fechar abaixo do esperado.
      </p>
      <p className="text-[hsl(38,92%,50%)] font-bold">
        Nao existe meio resultado. Ou entregamos, ou explicamos. O mercado nao espera. O cliente nao espera. A concorrencia nao para.
      </p>
      <p>
        Cada consultor precisa olhar para sua carteira AGORA. Nao amanha. AGORA. Onde estao os negocios que podem ser fechados essa semana?
        Onde estao os clientes que ja foram visitados mas nao receberam proposta?
      </p>
      <p className="font-bold text-lg">
        O desafio e claro. A responsabilidade e de TODOS. Vamos fazer acontecer.
      </p>
    </div>
  );
}
