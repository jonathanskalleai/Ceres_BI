import { Trophy, Target, Rocket, Banknote, TrendingUp } from "lucide-react";
import { SlideLayout, StatBox, RankRow } from "./SlideComponents";
import { fmt, fmtPct, META, type ApresentacaoData } from "./useApresentacaoData";

/** Slides 5–8: Projeção, Recebido vs Usados, Ranking, Plano de Ação, Encerramento */
export function buildSlidesDetail(data: ApresentacaoData): Array<() => JSX.Element> {
  const { neg2026, realizado, projecao, totalRecebido, projecaoRecebido, projecaoUsados, consultores, crm2026, mediaNecessaria } = data;

  return [
    // 5 — PROJEÇÃO
    () => (
      <SlideLayout title="SE CONTINUARMOS NESSE RITMO..." subtitle="Projeção de fechamento anual 2026" icon={<Target />}>
        <div className="flex items-center justify-center gap-16 mt-12">
          <div className="text-center space-y-3 anim-scale-in" style={{ animationDelay: "0.2s" }}>
            <p className="text-sm font-bold tracking-widest text-[hsl(215,16%,57%)] uppercase">Projeção Anual</p>
            <p className={`text-7xl font-black ${projecao >= META ? "text-[hsl(152,69%,40%)]" : "text-[hsl(0,84%,60%)]"}`}>
              {fmt(projecao)}
            </p>
          </div>
          <div className="text-8xl font-black text-[hsl(217,33%,25%)] anim-fade-up" style={{ animationDelay: "0.3s" }}>vs</div>
          <div className="text-center space-y-3 anim-scale-in" style={{ animationDelay: "0.4s" }}>
            <p className="text-sm font-bold tracking-widest text-[hsl(215,16%,57%)] uppercase">Meta</p>
            <p className="text-7xl font-black text-[hsl(217,91%,60%)]">{fmt(META)}</p>
          </div>
        </div>
        <div className="mt-10 mx-20 bg-[hsl(222,47%,9%)] border border-[hsl(217,33%,17%)] rounded-2xl p-6 text-center anim-fade-up" style={{ animationDelay: "0.6s" }}>
          {projecao >= META ? (
            <p className="text-2xl font-bold text-[hsl(152,69%,40%)]">
              Projeção acima da meta! Manter intensidade e não relaxar.
            </p>
          ) : (
            <p className="text-2xl font-bold text-[hsl(0,84%,60%)]">
              Risco de fechar o ano {fmt(META - projecao)} ABAIXO da meta
            </p>
          )}
        </div>
      </SlideLayout>
    ),

    // 6 — RECEBIDO TOTAL vs USADOS
    () => (
      <SlideLayout title="RECEBIDO TOTAL vs USADOS" subtitle="Quanto realmente entra em dinheiro para a empresa" icon={<Banknote />}>
        <div className="grid grid-cols-3 gap-8 mt-8">
          <StatBox icon={<TrendingUp />} label="Valor Vendido" value={fmt(realizado)} color="hsl(217,91%,60%)" delay={0.1} large />
          <StatBox icon={<Banknote />} label="Recebido em Dinheiro" value={fmt(totalRecebido)} color="hsl(152,69%,40%)" delay={0.2} large />
          <div className="bg-[hsl(222,47%,9%)] border border-[hsl(0,84%,25%)] rounded-xl p-6 text-center anim-scale-in" style={{ animationDelay: "0.3s" }}>
            <div className="flex items-center justify-center gap-2 mb-3 text-[hsl(0,84%,60%)]">
              <span className="text-xs font-bold tracking-widest uppercase">Usados Recebidos</span>
            </div>
            <p className="text-4xl font-black text-[hsl(0,84%,60%)]">{fmt(neg2026.totalUsado)}</p>
            <p className="text-sm text-[hsl(215,16%,57%)] mt-2">{fmtPct(neg2026.pctUsado)} do faturamento</p>
          </div>
        </div>
        <div className="mt-6 mx-4 anim-fade-up" style={{ animationDelay: "0.4s" }}>
          <div className="flex justify-between text-xs text-[hsl(215,16%,57%)] mb-1">
            <span>Recebido em Dinheiro: {fmtPct(neg2026.pctRecebido)}</span>
            <span>Usados: {fmtPct(neg2026.pctUsado)}</span>
          </div>
          <div className="h-5 rounded-full bg-[hsl(217,33%,17%)] overflow-hidden flex">
            <div className="h-full bg-[hsl(152,69%,40%)] anim-bar-grow" style={{ width: `${neg2026.pctRecebido}%` }} />
            <div className="h-full bg-[hsl(0,84%,50%)]" style={{ width: `${neg2026.pctUsado}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 mt-6">
          <div className="bg-[hsl(222,47%,9%)] border border-[hsl(217,33%,17%)] rounded-xl p-6 anim-fade-up" style={{ animationDelay: "0.5s" }}>
            <h3 className="text-sm font-bold text-[hsl(152,69%,40%)] mb-3 tracking-widest uppercase">Projeção Anual</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-[hsl(215,16%,57%)]">Projeção Volume Vendas</span>
                <span className="text-lg font-bold">{fmt(projecao)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-[hsl(215,16%,57%)]">Projeção Recebido Total</span>
                <span className="text-lg font-bold text-[hsl(152,69%,40%)]">{fmt(projecaoRecebido)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-[hsl(217,33%,17%)] pt-2">
                <span className="text-sm text-[hsl(215,16%,57%)]">Projeção Usados (capital parado)</span>
                <span className="text-lg font-bold text-[hsl(0,84%,60%)]">{fmt(projecaoUsados)}</span>
              </div>
            </div>
          </div>
          <div className="bg-[hsl(222,47%,9%)] border border-[hsl(38,92%,25%)] rounded-xl p-6 anim-fade-up" style={{ animationDelay: "0.6s" }}>
            <h3 className="text-sm font-bold text-[hsl(38,92%,50%)] mb-3 tracking-widest uppercase">Impacto no Caixa</h3>
            <div className="space-y-3 text-sm leading-relaxed text-[hsl(210,40%,96%)]">
              <p>De cada <strong>R$ 1</strong> vendido, apenas <strong>{fmtPct(neg2026.pctRecebido)}</strong> entra em dinheiro.</p>
              <p><strong>{fmtPct(neg2026.pctUsado)}</strong> retorna como equipamento usado — capital parado até revenda.</p>
              <p className="text-[hsl(38,92%,50%)] font-bold">Estratégia: acelerar a venda dos usados e priorizar negociações com pagamento direto.</p>
            </div>
          </div>
        </div>
      </SlideLayout>
    ),

    // 7 — RANKING
    () => (
      <SlideLayout title="RANKING DE CONSULTORES 2026" subtitle="Quem está entregando resultado em 2026" icon={<Trophy />}>
        <div className="grid grid-cols-2 gap-8 mt-6 px-4">
          <div className="anim-fade-up" style={{ animationDelay: "0.1s" }}>
            <h3 className="text-sm font-bold text-[hsl(215,16%,57%)] mb-3 tracking-widest uppercase">Por Volume (R$)</h3>
            <div className="space-y-2">
              {[...consultores].sort((a, b) => b.valor - a.valor).slice(0, 8).map((c, i) => (
                <RankRow key={c.nome} pos={i + 1} name={c.nome} value={fmt(c.valor)} isTop={i < 3} delay={0.15 + i * 0.05} />
              ))}
            </div>
          </div>
          <div className="anim-fade-up" style={{ animationDelay: "0.2s" }}>
            <h3 className="text-sm font-bold text-[hsl(215,16%,57%)] mb-3 tracking-widest uppercase">Por Conversão (%)</h3>
            <div className="space-y-2">
              {[...consultores].sort((a, b) => b.conversao - a.conversao).slice(0, 8).map((c, i) => (
                <RankRow key={c.nome} pos={i + 1} name={c.nome} value={`${c.conversao}%`} isTop={i < 3} delay={0.15 + i * 0.05} />
              ))}
            </div>
          </div>
        </div>
      </SlideLayout>
    ),

    // 8 — PLANO DE AÇÃO
    () => (
      <SlideLayout title="O QUE VAMOS FAZER" subtitle="Plano de aceleração comercial 2026" icon={<Rocket />}>
        <div className="space-y-5 mt-6 px-8">
          {[
            { n: "01", t: "Revisar 100% dos negócios em aberto", d: `${neg2026.emAndamento} negócios aguardando definição — priorizar por valor` },
            { n: "02", t: "Atacar clientes com potencial não convertido", d: "Clientes com múltiplas visitas e zero fechamento precisam de proposta imediata" },
            { n: "03", t: "Aumentar frequência de visitas nas regiões-chave", d: `${crm2026.totalCidades} cidades ativas — concentrar nas de maior potencial` },
            { n: "04", t: "Reunião semanal de pipeline", d: "Todo consultor apresenta seus 5 maiores negócios e próximos passos" },
            { n: "05", t: "Meta individual semanal de fechamento", d: `Cada consultor precisa fechar ${fmt(mediaNecessaria / Math.max(1, consultores.length))} por mês` },
          ].map((a, i) => (
            <div key={a.n} className="flex items-center gap-5 bg-[hsl(222,47%,9%)] border border-[hsl(217,33%,17%)] rounded-xl p-5 anim-fade-up" style={{ animationDelay: `${0.1 + i * 0.12}s` }}>
              <span className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(217,91%,60%)] to-[hsl(152,69%,40%)] flex items-center justify-center text-lg font-black text-[hsl(0,0%,100%)] shrink-0">
                {a.n}
              </span>
              <div>
                <p className="font-bold text-lg">{a.t}</p>
                <p className="text-sm text-[hsl(215,16%,57%)]">{a.d}</p>
              </div>
            </div>
          ))}
        </div>
      </SlideLayout>
    ),

    // 9 — ENCERRAMENTO
    () => (
      <div className="flex flex-col items-center justify-center h-full relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(222,47%,4%)] via-[hsl(217,91%,10%)] to-[hsl(222,47%,4%)]" />
        <div className="absolute inset-0 opacity-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="absolute rounded-full bg-[hsl(152,69%,40%)]" style={{
              width: `${150 + i * 80}px`, height: `${150 + i * 80}px`,
              top: `${5 + i * 10}%`, right: `${-10 + i * 12}%`, filter: "blur(60px)",
            }} />
          ))}
        </div>
        <div className="relative z-10 text-center space-y-8 px-16">
          <p className="text-5xl font-black text-[hsl(210,40%,96%)] leading-tight anim-fade-up" style={{ animationDelay: "0.2s" }}>
            O RESULTADO DE <span className="text-[hsl(217,91%,60%)]">2026</span>
            <br />
            DEPENDE DO QUE FAZEMOS <span className="text-[hsl(38,92%,50%)]">HOJE</span>
          </p>
          <div className="h-1 w-32 mx-auto bg-gradient-to-r from-[hsl(38,92%,50%)] to-[hsl(0,84%,60%)] rounded-full anim-fade-up" style={{ animationDelay: "0.4s" }} />
          <p className="text-3xl font-bold text-[hsl(152,69%,40%)] anim-fade-up" style={{ animationDelay: "0.5s" }}>
            Ou aceleramos, ou ficamos para trás.
          </p>
          <div className="mt-8 inline-flex items-center gap-3 bg-[hsl(152,69%,40%)/15] border border-[hsl(152,69%,40%)/30] rounded-full px-8 py-3 anim-scale-in" style={{ animationDelay: "0.7s" }}>
            <Rocket className="h-6 w-6 text-[hsl(152,69%,40%)]" />
            <span className="text-lg font-bold tracking-widest uppercase text-[hsl(152,69%,40%)]">Vamos juntos!</span>
          </div>
          <p className="text-sm text-[hsl(215,16%,57%)] mt-4 anim-fade-up" style={{ animationDelay: "0.9s" }}>Ceres Equipamentos Agrícolas — Performance Comercial 2026</p>
        </div>
      </div>
    ),
  ];
}
