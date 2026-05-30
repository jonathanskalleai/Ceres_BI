import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { DadosComerciais } from "@/types/comercial";
import { NegociosSummary } from "@/hooks/useNegociosData";
import { isAdminUser } from "@/lib/adminUsers";
import {
  ChevronLeft, ChevronRight, Maximize, Minimize, Trophy, Target,
  TrendingUp, Users, MapPin, Handshake, Zap, Rocket, BarChart3, Banknote
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";

const META = 30_000_000;

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtNum = (v: number) => v.toLocaleString("pt-BR");
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

interface Props {
  crmData: DadosComerciais;
  negData: NegociosSummary;
}

export function Apresentacao2026({ crmData, negData }: Props) {
  const [slide, setSlide] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [animKey, setAnimKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Filter CRM data for 2026 only ──
  const crm2026 = useMemo(() => {
    const regs2026 = crmData.registrosRecentes.filter(r => r.dtConclusao?.startsWith("2026"));
    const clienteSet = new Set<string>();
    const cidadeSet = new Set<string>();
    const vendedorSet = new Set<string>();
    let visitas = 0;
    for (const r of regs2026) {
      if (r.cliente) clienteSet.add(r.cliente);
      if (r.cidade) cidadeSet.add(r.cidade);
      if (r.vendedor && !isAdminUser(r.vendedor)) vendedorSet.add(r.vendedor);
      if (r.tipoContato?.toLowerCase().includes("visita")) visitas++;
    }
    return {
      totalRegistros: regs2026.length,
      totalClientes: clienteSet.size,
      totalCidades: cidadeSet.size,
      totalVisitas: visitas,
      totalConsultores: vendedorSet.size,
    };
  }, [crmData]);

  // ── Filter negócios for 2026 only ──
  const neg2026 = useMemo(() => {
    const regs = negData.registros.filter(r => r.pdo_dth_abertura?.startsWith("2026"));
    const ganhos = regs.filter(r => r.ngo_conclusao === "Ganho");
    const emAndamento = regs.filter(r => r.ngo_conclusao === "Em andamento");
    const totalValor = regs.reduce((s, r) => s + r.valor_pedido, 0);
    const totalRecebido = regs.reduce((s, r) => s + (r.recebido || 0), 0);
    const totalUsado = regs.reduce((s, r) => s + (r.pdo_vlr_recurso_proprio || 0), 0);
    const pctUsado = totalValor > 0 ? (totalUsado / totalValor) * 100 : 0;
    const pctRecebido = totalValor > 0 ? (totalRecebido / totalValor) * 100 : 0;

    // Evolução mensal 2026
    const evolMap = new Map<string, { total: number; valor: number; ganhos: number }>();
    for (const r of regs) {
      const ym = r.pdo_dth_abertura?.slice(0, 7);
      if (!ym) continue;
      if (!evolMap.has(ym)) evolMap.set(ym, { total: 0, valor: 0, ganhos: 0 });
      const e = evolMap.get(ym)!;
      e.total++;
      e.valor += r.valor_pedido;
      if (r.ngo_conclusao === "Ganho") e.ganhos++;
    }
    const evolucao = Array.from(evolMap.entries())
      .map(([mes, e]) => ({ mes, ...e }))
      .sort((a, b) => a.mes.localeCompare(b.mes));

    // Por consultor 2026
    const cMap = new Map<string, { total: number; valor: number; ganhos: number; conversao: number }>();
    for (const r of regs) {
      if (!r.consultor || isAdminUser(r.consultor)) continue;
      if (!cMap.has(r.consultor)) cMap.set(r.consultor, { total: 0, valor: 0, ganhos: 0, conversao: 0 });
      const c = cMap.get(r.consultor)!;
      c.total++;
      c.valor += r.valor_pedido;
      if (r.ngo_conclusao === "Ganho") c.ganhos++;
    }
    const consultores = Array.from(cMap.entries())
      .map(([nome, c]) => ({ nome, ...c, conversao: c.total > 0 ? Math.round((c.ganhos / c.total) * 100) : 0 }))
      .sort((a, b) => b.valor - a.valor);

    const mesesPassados = evolucao.length || 1;

    return {
      totalNegocios: regs.length,
      totalValor,
      totalRecebido,
      totalUsado,
      pctUsado,
      pctRecebido,
      ganhos: ganhos.length,
      emAndamento: emAndamento.length,
      evolucao,
      consultores,
      mesesPassados,
    };
  }, [negData]);

  const realizado = neg2026.totalValor;
  const pct = (realizado / META) * 100;
  const gap = META - realizado;
  const mesesPassados = neg2026.mesesPassados;
  const mediaAtual = mesesPassados > 0 ? realizado / mesesPassados : 0;
  const projecao = mediaAtual * 12;
  const mediaNecessaria = gap / Math.max(1, 12 - mesesPassados);
  const consultores = neg2026.consultores;
  const totalRecebido = neg2026.totalRecebido;
  const projecaoRecebido = mesesPassados > 0 ? (totalRecebido / mesesPassados) * 12 : 0;
  const projecaoUsados = projecao - projecaoRecebido;

  const goToSlide = useCallback((idx: number, dir: "next" | "prev") => {
    setDirection(dir);
    setSlide(idx);
    setAnimKey(k => k + 1);
  }, []);

  const next = useCallback(() => {
    setSlide(s => {
      const n = Math.min(s + 1, slides.length - 1);
      if (n !== s) { setDirection("next"); setAnimKey(k => k + 1); }
      return n;
    });
  }, []);

  const prev = useCallback(() => {
    setSlide(s => {
      const n = Math.max(s - 1, 0);
      if (n !== s) { setDirection("prev"); setAnimKey(k => k + 1); }
      return n;
    });
  }, []);

  const slides = [
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
              ? <span className="text-[hsl(152,69%,40%)]">✅ Estamos no ritmo — mas não podemos desacelerar!</span>
              : <span className="text-[hsl(0,84%,60%)]">⚠️ Precisamos vender {fmt(mediaNecessaria - mediaAtual)} A MAIS por mês</span>
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
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={neg2026.evolucao}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,17%)" />
                <XAxis dataKey="mes" tick={{ fill: "hsl(215,16%,57%)", fontSize: 14 }} />
                <YAxis tick={{ fill: "hsl(215,16%,57%)", fontSize: 14 }} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "hsl(222,47%,9%)", border: "1px solid hsl(217,33%,17%)", borderRadius: 8, color: "hsl(210,40%,96%)" }} />
                <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                  {neg2026.evolucao.map((e, i) => (
                    <Cell key={i} fill={e.valor >= META / 12 ? "hsl(152,69%,40%)" : "hsl(217,91%,60%)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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
              🎯 Projeção acima da meta! Manter intensidade e não relaxar.
            </p>
          ) : (
            <p className="text-2xl font-bold text-[hsl(0,84%,60%)]">
              🚨 Risco de fechar o ano {fmt(META - projecao)} ABAIXO da meta
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
        {/* Barra de progresso Recebido / Vendido */}
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
            <h3 className="text-sm font-bold text-[hsl(38,92%,50%)] mb-3 tracking-widest uppercase">⚠️ Impacto no Caixa</h3>
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

    // 7 — PLANO DE AÇÃO
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

    // 8 — ENCERRAMENTO
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

  const totalSlides = slides.length;

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      if (e.key === "Escape" && isFullscreen) document.exitFullscreen();
      if (e.key === "f" || e.key === "F5") { e.preventDefault(); toggleFullscreen(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev, isFullscreen, toggleFullscreen]);

  const slideAnimClass = direction === "next" ? "slide-enter-right" : "slide-enter-left";

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[hsl(222,47%,4%)] flex flex-col">
      {/* CSS animations */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.88); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes barGrow {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes slideEnterRight {
          from { opacity: 0; transform: translateX(60px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideEnterLeft {
          from { opacity: 0; transform: translateX(-60px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .anim-fade-up {
          animation: fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) both;
        }
        .anim-scale-in {
          animation: scaleIn 0.6s cubic-bezier(0.16,1,0.3,1) both;
        }
        .anim-bar-grow {
          animation: barGrow 1s cubic-bezier(0.16,1,0.3,1) both;
          transform-origin: left;
          animation-delay: 0.4s;
        }
        .slide-enter-right {
          animation: slideEnterRight 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }
        .slide-enter-left {
          animation: slideEnterLeft 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }
      `}</style>

      {/* Slide area */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        <div className="w-full h-full max-w-[1920px] max-h-[1080px] aspect-video relative">
          <div key={animKey} className={`absolute inset-0 text-[hsl(210,40%,96%)] ${slideAnimClass}`}>
            {slides[slide]()}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className={`flex items-center justify-between px-6 py-3 bg-[hsl(222,47%,6%)] border-t border-[hsl(217,33%,17%)] ${isFullscreen ? "absolute bottom-0 left-0 right-0 opacity-0 hover:opacity-100 transition-opacity" : ""}`}>
        <div className="flex items-center gap-2">
          <button onClick={prev} disabled={slide === 0} className="p-2 rounded-lg hover:bg-[hsl(217,33%,17%)] disabled:opacity-30 transition-colors text-[hsl(210,40%,96%)]">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-mono text-[hsl(215,16%,57%)] min-w-[60px] text-center">
            {slide + 1} / {totalSlides}
          </span>
          <button onClick={next} disabled={slide === totalSlides - 1} className="p-2 rounded-lg hover:bg-[hsl(217,33%,17%)] disabled:opacity-30 transition-colors text-[hsl(210,40%,96%)]">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Dots */}
        <div className="flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button key={i} onClick={() => goToSlide(i, i > slide ? "next" : "prev")}
              className={`h-2 rounded-full transition-all duration-300 ${i === slide ? "w-6 bg-[hsl(217,91%,60%)]" : "w-2 bg-[hsl(217,33%,25%)] hover:bg-[hsl(217,33%,35%)]"}`}
            />
          ))}
        </div>

        <button onClick={toggleFullscreen} className="p-2 rounded-lg hover:bg-[hsl(217,33%,17%)] transition-colors text-[hsl(210,40%,96%)]">
          {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}

// --- Reusable slide sub-components ---

function SlideLayout({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-[hsl(222,47%,6%)] to-[hsl(222,47%,8%)]">
      <div className="px-12 pt-10 pb-4 border-b border-[hsl(217,33%,17%)]">
        <div className="flex items-center gap-3 mb-1 anim-fade-up">
          <span className="text-[hsl(217,91%,60%)]">{icon}</span>
          <h2 className="text-3xl font-black tracking-tight">{title}</h2>
        </div>
        <p className="text-sm text-[hsl(215,16%,57%)] ml-10 anim-fade-up" style={{ animationDelay: "0.05s" }}>{subtitle}</p>
      </div>
      <div className="flex-1 px-12 py-4 overflow-hidden">
        {children}
      </div>
      <div className="px-12 py-2 border-t border-[hsl(217,33%,12%)] flex justify-between text-xs text-[hsl(215,16%,57%)]">
        <span>Ceres Equipamentos Agrícolas</span>
        <span>Performance Comercial 2026</span>
      </div>
    </div>
  );
}

function StatBox({ icon, label, value, color, large, delay = 0 }: { icon: React.ReactNode; label: string; value: string; color: string; large?: boolean; delay?: number }) {
  return (
    <div className="bg-[hsl(222,47%,9%)] border border-[hsl(217,33%,17%)] rounded-xl p-6 text-center anim-scale-in" style={{ animationDelay: `${delay}s` }}>
      <div className="flex items-center justify-center gap-2 mb-3" style={{ color }}>
        {icon}
        <span className="text-xs font-bold tracking-widest uppercase">{label}</span>
      </div>
      <p className={`font-black ${large ? "text-4xl" : "text-3xl"}`} style={{ color }}>{value}</p>
    </div>
  );
}

function RankRow({ pos, name, value, isTop, delay = 0 }: { pos: number; name: string; value: string; isTop: boolean; delay?: number }) {
  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg anim-fade-up ${isTop ? "bg-[hsl(152,69%,10%)] border border-[hsl(152,69%,25%)]" : "bg-[hsl(217,33%,12%)]"}`} style={{ animationDelay: `${delay}s` }}>
      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isTop ? "bg-[hsl(38,92%,50%)] text-[hsl(222,47%,6%)]" : "bg-[hsl(217,33%,17%)] text-[hsl(215,16%,57%)]"}`}>
        {pos}
      </span>
      <span className="flex-1 text-sm font-medium truncate">{name}</span>
      <span className="text-sm font-bold">{value}</span>
      {isTop && <Trophy className="h-4 w-4 text-[hsl(38,92%,50%)]" />}
    </div>
  );
}
