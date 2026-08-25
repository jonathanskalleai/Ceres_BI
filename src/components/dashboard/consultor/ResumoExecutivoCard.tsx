import { useState, useEffect, useMemo } from "react";
import { Sparkles, ChevronDown, ChevronUp, User, Users, ShoppingBag, CalendarCheck, TrendingUp, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAI } from "@/lib/fetchAI";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InsightConsultorCard } from "./InsightConsultorCard";
import type { RpcConsultorResumoAcoes } from "@/types/consultoresRpc";
import { formatBRL } from "@/lib/dateUtils";

interface InsightItem {
  tipo: string;
  titulo: string;
  descricao: string;
  consultor: string | null;
  prioridade: string;
}

interface InsightEquipe {
  destaque_semana?: string;
  insights?: InsightItem[];
  acoes_gestor?: string[];
  semana_inicio?: string;
  semana_fim?: string;
}

interface ResumoExecutivoCardProps {
  resumo: RpcConsultorResumoAcoes[];
  consultores: string[];
}

function formatDateShort(dateStr?: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  return `${parts[2]}/${parts[1]}`;
}

export function ResumoExecutivoCard({ resumo, consultores = [] }: ResumoExecutivoCardProps) {
  const [currentAi, setCurrentAi] = useState<InsightEquipe | null>(null);
  const [historico, setHistorico] = useState<InsightEquipe[]>([]);
  const [loadingAi, setLoadingAi] = useState(true);
  const [showHistorico, setShowHistorico] = useState(false);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [showResumoModal, setShowResumoModal] = useState(false);
  const [selectedConsultor, setSelectedConsultor] = useState<string>("");

  useEffect(() => {
    fetchAI("/api/ai/insights?tipo=equipe")
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.message) setCurrentAi(data);
        setLoadingAi(false);
      })
      .catch(() => setLoadingAi(false));
  }, []);

  const loadHistorico = () => {
    if (historico.length > 0) {
      setShowHistorico(!showHistorico);
      return;
    }
    fetchAI("/api/ai/insights?all=true")
      .then((r) => r.json())
      .then((data) => {
        if (data?.semanas) {
          setHistorico(data.semanas.slice(1));
        }
        setShowHistorico(true);
      });
  };

  // Aggregated totals from real RPC data
  const totais = useMemo(() => {
    return resumo.reduce(
      (acc, item) => ({
        totalVendido: acc.totalVendido + Number(item.valor_ganho || 0),
        totalGanhos: acc.totalGanhos + Number(item.ganhos || 0),
        totalAcoes: acc.totalAcoes + Number(item.acoes || 0),
        totalVisitas: acc.totalVisitas + Number(item.visitas || 0),
        totalClientes: acc.totalClientes + Number(item.clientes || 0),
        totalPipeline: acc.totalPipeline + Number(item.pipeline_aberto_gerado || 0),
      }),
      {
        totalVendido: 0,
        totalGanhos: 0,
        totalAcoes: 0,
        totalVisitas: 0,
        totalClientes: 0,
        totalPipeline: 0,
      }
    );
  }, [resumo]);

  return (
    <div
      className="flex flex-col justify-between h-full rounded-2xl border p-5 transition-all duration-200"
      style={{
        background: "var(--surface-raised)",
        borderColor: "var(--voux-card-border)",
        boxShadow: "var(--voux-card-shadow)",
      }}
    >
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}
          >
            Resumo Executivo
          </span>
          <div className="flex items-center gap-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-medium">ao vivo</span>
          </div>
        </div>

        {/* Headline KPI: Total Vendido */}
        <div className="mb-4">
          <p
            className="text-2xl lg:text-3xl font-bold tracking-tight tabular-nums"
            style={{ fontFamily: "var(--voux-font-display)", color: "var(--voux-text-heading)" }}
          >
            {formatBRL(totais.totalVendido)}
          </p>
          <div className="flex items-center justify-between text-[12px] mt-1 mb-2" style={{ color: "var(--voux-text-faint)" }}>
            <span>Total vendido no período</span>
            <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
              {totais.totalGanhos} pedidos ganhos
            </span>
          </div>
          {/* Accent Gold Progress Bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300"
              style={{ width: "100%" }}
            />
          </div>
        </div>

        {/* Sub-KPIs Strip with Colored Mini Bars */}
        <div className="space-y-3.5 pt-2 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
          {/* Clientes Únicos */}
          <div>
            <div className="flex items-center justify-between text-[12px] mb-1">
              <span className="flex items-center gap-1.5 font-medium" style={{ color: "var(--voux-text-primary)" }}>
                <Users className="h-3.5 w-3.5 text-sky-500" />
                Clientes atendidos
              </span>
              <span className="font-mono font-bold tabular-nums" style={{ color: "var(--voux-text-heading)" }}>
                {totais.totalClientes.toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
              <div className="h-full rounded-full bg-sky-500" style={{ width: "85%" }} />
            </div>
          </div>

          {/* Vendas Fechadas (Ganhos) */}
          <div>
            <div className="flex items-center justify-between text-[12px] mb-1">
              <span className="flex items-center gap-1.5 font-medium" style={{ color: "var(--voux-text-primary)" }}>
                <ShoppingBag className="h-3.5 w-3.5 text-emerald-500" />
                Vendas fechadas
              </span>
              <span className="font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {totais.totalGanhos.toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: "90%" }} />
            </div>
          </div>

          {/* Ações & Visitas */}
          <div>
            <div className="flex items-center justify-between text-[12px] mb-1">
              <span className="flex items-center gap-1.5 font-medium" style={{ color: "var(--voux-text-primary)" }}>
                <CalendarCheck className="h-3.5 w-3.5 text-purple-500" />
                Ações de campo & visitas
              </span>
              <span className="font-mono font-bold tabular-nums" style={{ color: "var(--voux-text-heading)" }}>
                {totais.totalAcoes.toLocaleString("pt-BR")} <span className="text-[11px] font-normal text-muted-foreground">({totais.totalVisitas} vis.)</span>
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
              <div className="h-full rounded-full bg-purple-500" style={{ width: "75%" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Embedded IA Copilot Box */}
      <div className="mt-4 pt-3 border-t space-y-2.5" style={{ borderColor: "var(--voux-card-border)" }}>
        <div
          className="rounded-xl border p-3 transition-colors"
          style={{
            borderColor: "var(--voux-card-border)",
            background: "var(--surface-base)",
          }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
            <span
              className="text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-accent)" }}
            >
              Inteligência da Equipe
            </span>
            {currentAi?.semana_inicio && (
              <span className="text-[10px] ml-auto font-mono text-muted-foreground">
                {formatDateShort(currentAi.semana_inicio)} a {formatDateShort(currentAi.semana_fim)}
              </span>
            )}
          </div>

          {loadingAi ? (
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-3/4" />
            </div>
          ) : currentAi?.destaque_semana ? (
            <div className="space-y-2 text-[12px] leading-relaxed">
              <p className="font-medium text-foreground/90 line-clamp-2">
                {currentAi.destaque_semana}
              </p>
              {currentAi.acoes_gestor && currentAi.acoes_gestor.length > 0 && (
                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  <span className="font-semibold text-amber-600 dark:text-amber-400">Sugestão:</span> {currentAi.acoes_gestor[0]}
                </p>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Acompanhamento semanal em tempo real com base nos registros e pedidos.
            </p>
          )}
        </div>

        {/* Action triggers */}
        <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
          <button
            type="button"
            onClick={loadHistorico}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            {showHistorico ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            <span className="font-mono">Histórico IA</span>
          </button>

          {consultores.length > 0 && (
            <button
              type="button"
              onClick={() => setShowResumoModal(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors"
            >
              <User className="h-3 w-3" />
              <span className="font-mono">Resumo Consultor</span>
            </button>
          )}
        </div>

        {/* Histórico expandido */}
        {showHistorico && historico.length > 0 && (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pt-1">
            {historico.map((semana, idx) => (
              <div
                key={idx}
                className="rounded-lg border p-2 text-[11px]"
                style={{ borderColor: "var(--voux-card-border)", background: "var(--surface-base)" }}
              >
                <div className="flex items-center justify-between font-mono font-medium mb-1">
                  <span>Semana {formatDateShort(semana.semana_inicio)} a {formatDateShort(semana.semana_fim)}</span>
                </div>
                <p className="text-muted-foreground line-clamp-2">{semana.destaque_semana}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal — Resumo individual do consultor */}
      <Dialog open={showResumoModal} onOpenChange={setShowResumoModal}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle
              className="text-base font-bold"
              style={{ fontFamily: "var(--voux-font-display)", color: "var(--voux-text-heading)" }}
            >
              Resumo individual do Consultor
            </DialogTitle>
            <DialogDescription className="text-[13px]" style={{ color: "var(--voux-text-faint)" }}>
              Selecione um consultor para ver o resumo semanal com IA.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2">
            <Select value={selectedConsultor} onValueChange={setSelectedConsultor}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o consultor" />
              </SelectTrigger>
              <SelectContent>
                {consultores.map((nome) => (
                  <SelectItem key={nome} value={nome}>
                    {nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedConsultor && (
            <div className="mt-4">
              <InsightConsultorCard consultor={selectedConsultor} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
