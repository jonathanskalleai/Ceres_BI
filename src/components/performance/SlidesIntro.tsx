import { BarChart3, Target, TrendingUp, Users, MapPin, Handshake, Zap } from "lucide-react";
import { BarChart } from "@/components/bi/charts";
import { SlideLayout, StatBox } from "./SlideComponents";
import { fmt, fmtNum, fmtPct, META, type ApresentacaoData } from "./useApresentacaoData";

/** Slides 0–4: Capa, Onde Estamos, Meta, Ritmo, Evolução */
export function buildSlidesIntro(data: ApresentacaoData): Array<() => JSX.Element> {
  const { crm2026, neg2026, realizado, pct, gap, mediaAtual, mediaNecessaria } = data;

  return [
    // 0 — CAPA
    () => (
      <div className="flex flex-col items-center justify-center h-full relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(222,47%,4%)] via-[hsl(222,47%,8%)] to-[hsl(217,91%,15%)]" />
        <div className="absolute top-0 left-0 w-full h-full opacity-10">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="absolute rounded-full bg-[hsl(217,91%,60%)]" style={{
              width: `${200 + i * 100}px`, height: `${200 + i * 100}px`,
              top: `${10 + i * 8}%`, left: `${-5 + i * 15}%`, filter: "blur(80px)",
            }} />
          ))}
        </div>
        <div className="relative z-10 text-center space-y-8 px-16">
          <div className="inline-flex items-center gap-3 bg-[hsl(217,91%,60%)/15] border border-[hsl(217,91%,60%)/30] rounded-full px-6 py-2 anim-fade-up" style={{ animationDelay: "0.1s" }}>
            <Zap className="h-5 w-5 text-[hsl(38,92%,50%)]" />
            <span className="text-sm font-bold tracking-[0.3em] uppercase text-[hsl(217,91%,60%)]">Ceres Equipamentos Agrícolas</span>
          </div>
          <h1 className="text-7xl font-black leading-tight tracking-tight anim-fade-up" style={{ animationDelay: "0.3s" }}>
            <span className="text-[hsl(210,40%,96%)]">O JOGO DE </span>
            <span className="text-[hsl(217,91%,60%)]">2026</span>
            <br />
            <span className="text-[hsl(210,40%,96%)]">JÁ COMEÇOU</span>
          </h1>
          <div className="h-1 w-32 mx-auto bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(152,69%,40%)] rounded-full anim-fade-up" style={{ animationDelay: "0.5s" }} />
          <p className="text-2xl font-bold text-[hsl(38,92%,50%)] anim-fade-up" style={{ animationDelay: "0.6s" }}>
            Ou aceleramos, ou ficamos para trás.
          </p>
          <p className="text-lg text-[hsl(215,16%,57%)] anim-fade-up" style={{ animationDelay: "0.8s" }}>Performance Comercial — Dados exclusivos de 2026</p>
        </div>
      </div>
    ),

    // 1 — ONDE ESTAMOS
    () => (
      <SlideLayout title="ONDE ESTAMOS EM 2026" subtitle="Panorama da operação comercial — apenas dados de 2026" icon={<BarChart3 />}>
        <div className="grid grid-cols-3 gap-8 mt-8">
          <StatBox icon={<Users />} label="Clientes Atendidos" value={fmtNum(crm2026.totalClientes)} color="hsl(217,91%,60%)" delay={0.1} />
          <StatBox icon={<Target />} label="Total de Visitas" value={fmtNum(crm2026.totalVisitas)} color="hsl(152,69%,40%)" delay={0.2} />
          <StatBox icon={<MapPin />} label="Cidades Ativas" value={fmtNum(crm2026.totalCidades)} color="hsl(38,92%,50%)" delay={0.3} />
        </div>
        <div className="grid grid-cols-3 gap-8 mt-6">
          <StatBox icon={<Handshake />} label="Negócios Fechados" value={fmtNum(neg2026.ganhos)} color="hsl(152,69%,40%)" delay={0.4} />
          <StatBox icon={<TrendingUp />} label="Total em Negócios" value={fmt(realizado)} color="hsl(217,91%,60%)" large delay={0.5} />
          <StatBox icon={<Users />} label="Consultores Ativos" value={fmtNum(crm2026.totalConsultores)} color="hsl(280,68%,60%)" delay={0.6} />
        </div>
        <div className="mt-8 text-center anim-fade-up" style={{ animationDelay: "0.7s" }}>
          <p className="text-xl text-[hsl(215,16%,57%)]">
            <span className="font-bold text-[hsl(210,40%,96%)]">{fmtNum(crm2026.totalRegistros)}</span> ações registradas no CRM em{" "}
            <span className="font-bold text-[hsl(210,40%,96%)]">{fmtNum(crm2026.totalCidades)}</span> cidades
          </p>
        </div>
      </SlideLayout>
    ),

    // 2 — A META
    () => (
      <SlideLayout title="A META: R$ 30 MILHÕES" subtitle="O tamanho do desafio em 2026" icon={<Target />}>
        <div className="flex items-center justify-center gap-16 mt-10">
          <div className="text-center space-y-2 anim-fade-up" style={{ animationDelay: "0.1s" }}>
            <p className="text-sm font-bold tracking-widest text-[hsl(215,16%,57%)] uppercase">Meta Anual</p>
            <p className="text-6xl font-black text-[hsl(217,91%,60%)]">{fmt(META)}</p>
          </div>
          <div className="h-24 w-px bg-[hsl(217,33%,17%)] anim-fade-up" style={{ animationDelay: "0.2s" }} />
          <div className="text-center space-y-2 anim-fade-up" style={{ animationDelay: "0.3s" }}>
            <p className="text-sm font-bold tracking-widest text-[hsl(215,16%,57%)] uppercase">Realizado 2026</p>
            <p className="text-6xl font-black text-[hsl(152,69%,40%)]">{fmt(realizado)}</p>
          </div>
          <div className="h-24 w-px bg-[hsl(217,33%,17%)] anim-fade-up" style={{ animationDelay: "0.4s" }} />
          <div className="text-center space-y-2 anim-fade-up" style={{ animationDelay: "0.5s" }}>
            <p className="text-sm font-bold tracking-widest text-[hsl(215,16%,57%)] uppercase">Gap</p>
            <p className="text-6xl font-black text-[hsl(0,84%,60%)]">{fmt(gap)}</p>
          </div>
        </div>
        <div className="mt-10 mx-16 anim-fade-up" style={{ animationDelay: "0.6s" }}>
          <div className="h-6 rounded-full bg-[hsl(217,33%,17%)] overflow-hidden relative">
            <div className="h-full rounded-full bg-gradient-to-r from-[hsl(152,69%,40%)] to-[hsl(217,91%,60%)] anim-bar-grow" style={{ width: `${Math.min(100, pct)}%` }} />
            <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-[hsl(0,0%,100%)]">{fmtPct(pct)} atingido</span>
          </div>
        </div>
        <p className="text-center mt-6 text-xl text-[hsl(38,92%,50%)] font-bold anim-fade-up" style={{ animationDelay: "0.8s" }}>
          Cada R$ 1 que não vendemos hoje, vira R$ 2 de pressão amanhã.
        </p>
      </SlideLayout>
    ),

    // 3 — RITMO VS NECESSIDADE
    () => (
      <SlideLayout title="RITMO: ATUAL vs NECESSÁRIO" subtitle="Velocidade de vendas para bater a meta em 2026" icon={<Zap />}>
        <div className="grid grid-cols-2 gap-12 mt-10 px-8">
          <div className="bg-[hsl(222,47%,9%)] border border-[hsl(217,33%,17%)] rounded-2xl p-8 text-center anim-scale-in" style={{ animationDelay: "0.2s" }}>
            <p className="text-sm font-bold tracking-widest text-[hsl(215,16%,57%)] uppercase mb-4">Média Atual / Mês</p>
            <p className="text-5xl font-black text-[hsl(0,84%,60%)]">{fmt(mediaAtual)}</p>
            <div className="mt-4 h-2 rounded-full bg-[hsl(217,33%,17%)] overflow-hidden">
              <div className="h-full bg-[hsl(0,84%,60%)] rounded-full anim-bar-grow" style={{ width: `${Math.min(100, (mediaAtual / mediaNecessaria) * 100)}%` }} />
            </div>
          </div>
          <div className="bg-[hsl(222,47%,9%)] border border-[hsl(152,69%,25%)] rounded-2xl p-8 text-center anim-scale-in" style={{ animationDelay: "0.4s" }}>
            <p className="text-sm font-bold tracking-widest text-[hsl(215,16%,57%)] uppercase mb-4">Média Necessária / Mês</p>
            <p className="text-5xl font-black text-[hsl(152,69%,40%)]">{fmt(mediaNecessaria)}</p>
            <div className="mt-4 h-2 rounded-full bg-[hsl(217,33%,17%)] overflow-hidden">
              <div className="h-full bg-[hsl(152,69%,40%)] rounded-full anim-bar-grow w-full" />
            </div>
          </div>
        </div>
        <div className="mt-8 text-center px-16 anim-fade-up" style={{ animationDelay: "0.6s" }}>
          <p className="text-2xl font-bold">
            {mediaAtual >= mediaNecessaria
              ? <span className="text-[hsl(152,69%,40%)]">Estamos no ritmo — mas não podemos desacelerar!</span>
              : <span className="text-[hsl(0,84%,60%)]">Precisamos vender {fmt(mediaNecessaria - mediaAtual)} A MAIS por mês</span>
            }
          </p>
        </div>
      </SlideLayout>
    ),

    // 4 — EVOLUÇÃO MENSAL
    () => (
      <SlideLayout title="EVOLUÇÃO MENSAL 2026" subtitle="Trajetória de vendas mês a mês — somente 2026" icon={<TrendingUp />}>
        <div className="mt-6 px-4 h-[380px] anim-fade-up" style={{ animationDelay: "0.2s" }}>
          {neg2026.evolucao.length > 0 ? (
            <BarChart
              data={neg2026.evolucao.map((e) => ({ name: e.mes, valor: e.valor }))}
              layout="vertical"
              keys={["valor"]}
              height={380}
              itemColors={neg2026.evolucao.map((e) =>
                e.valor >= META / 12 ? "hsl(152,69%,40%)" : "hsl(217,91%,60%)"
              )}
              tooltipFormatter={(v) => fmt(v)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-[hsl(215,16%,57%)]">
              <p className="text-lg">Dados de evolução mensal ainda não disponíveis para 2026</p>
            </div>
          )}
        </div>
        <p className="text-center text-[hsl(215,16%,57%)] text-sm mt-2">
          Linha de meta mensal: {fmt(META / 12)}
        </p>
      </SlideLayout>
    ),
  ];
}
