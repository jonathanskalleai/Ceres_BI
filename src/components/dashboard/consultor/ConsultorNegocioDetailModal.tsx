import { memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  Calendar,
  DollarSign,
  Flame,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Tag,
  Clock,
  Building2,
  FileText,
  CreditCard,
  Truck,
  ExternalLink,
} from "lucide-react";
import type { RpcConsultorNegocioPipeline } from "@/types/consultoresRpc";
import { formatDateBR } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";

interface Props {
  negocio: RpcConsultorNegocioPipeline | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BRL_EXACT = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatBRL(value: number | null | undefined): string {
  if (value == null) return "R$ 0,00";
  return BRL_EXACT.format(Number(value));
}

function getEtapaBadge(etapa: string) {
  const upper = (etapa || "").toUpperCase();
  if (upper.includes("1-") || upper.includes("OPORTUNIDADE")) {
    return { label: "1. Oportunidade", bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" };
  }
  if (upper.includes("2-") || upper.includes("COTACAO") || upper.includes("COTAÇÃO")) {
    return { label: "2. Cotação", bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" };
  }
  if (upper.includes("3-") || upper.includes("PROPOSTA")) {
    return { label: "3. Proposta ao Cliente", bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" };
  }
  return { label: etapa || "Funil de Vendas", bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" };
}

function getTermometroInfo(estrelas: number) {
  const count = Math.min(Math.max(estrelas || 0, 0), 5);
  switch (count) {
    case 5:
      return {
        label: "5/5 ★ Quentíssimo (Fechamento Iminente)",
        probabilidade: "100%",
        percent: 100,
        color: "text-amber-400",
        barColor: "bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-500",
        badgeBg: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",
        stars: "★★★★★",
        descricao: "Negócio com altíssima probabilidade de fechamento a curto prazo.",
      };
    case 4:
      return {
        label: "4/5 ★ Alta Probabilidade (Negociação Avançada)",
        probabilidade: "80%",
        percent: 80,
        color: "text-emerald-500",
        barColor: "bg-emerald-500",
        badgeBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
        stars: "★★★★☆",
        descricao: "Proposta aceita em princípio, em fase de aprovação de crédito ou documentação.",
      };
    case 3:
      return {
        label: "3/5 ★ Probabilidade Média (Em Andamento / Morno)",
        probabilidade: "60%",
        percent: 60,
        color: "text-amber-500",
        barColor: "bg-amber-500",
        badgeBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
        stars: "★★★☆☆",
        descricao: "Cliente demonstrando interesse real, cotações e simulações em andamento.",
      };
    case 2:
      return {
        label: "2/5 ★ Baixa Probabilidade (Qualificação / Frio)",
        probabilidade: "40%",
        percent: 40,
        color: "text-sky-500",
        barColor: "bg-sky-500",
        badgeBg: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
        stars: "★★☆☆☆",
        descricao: "Primeiras sondagens de preço e verificação de disponibilidade.",
      };
    case 1:
      return {
        label: "1/5 ★ Prospecção Inicial",
        probabilidade: "20%",
        percent: 20,
        color: "text-rose-500",
        barColor: "bg-rose-500",
        badgeBg: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
        stars: "★☆☆☆☆",
        descricao: "Contato inicial realizado, aguardando levantamento de necessidade.",
      };
    default:
      return {
        label: "Sem estrelas definidas",
        probabilidade: "—",
        percent: 0,
        color: "text-muted-foreground",
        barColor: "bg-muted",
        badgeBg: "bg-muted text-muted-foreground border-border",
        stars: "☆☆☆☆☆",
        descricao: "Negócio ainda não classificado no termômetro de fechamento.",
      };
  }
}

export const ConsultorNegocioDetailModal = memo(function ConsultorNegocioDetailModal({
  negocio,
  open,
  onOpenChange,
}: Props) {
  if (!negocio) return null;

  const etapaBadge = getEtapaBadge(negocio.etapa);
  const termometro = getTermometroInfo(negocio.estrelas);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[96vw] max-w-6xl max-h-[92vh] overflow-y-auto rounded-2xl border p-0 gap-0"
        style={{
          background: "var(--surface-raised)",
          borderColor: "var(--voux-card-border)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* Header Horizontal Compacto */}
        <div className="px-6 py-4 border-b space-y-2" style={{ borderColor: "var(--voux-card-border)", background: "rgba(0,0,0,0.02)" }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border", etapaBadge.bg)}>
                {etapaBadge.label}
              </span>
              <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border", termometro.badgeBg)}>
                <Flame className="h-3.5 w-3.5 text-amber-500" />
                <span className="tracking-widest text-amber-500">{termometro.stars}</span>
                <span>{termometro.probabilidade}</span>
              </span>
              {negocio.prioridade && negocio.prioridade !== "Média" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
                  Prioridade {negocio.prioridade}
                </span>
              )}
            </div>

            <span className="text-xs font-mono text-muted-foreground mr-6">
              Registro #{negocio.numero}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <DialogTitle
                className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate"
                style={{ fontFamily: "var(--voux-font-display)" }}
              >
                {negocio.cliente}
              </DialogTitle>
              <DialogDescription className="text-xs font-mono text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                {negocio.cidade && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    {negocio.cidade} {negocio.uf ? `· ${negocio.uf}` : ""}
                  </span>
                )}
                {negocio.cnpj_cpf && (
                  <span>CPF/CNPJ: {negocio.cnpj_cpf}</span>
                )}
                {negocio.telefone && (
                  <span className="flex items-center gap-1 font-bold text-foreground">
                    <Phone className="h-3 w-3 text-emerald-500" />
                    {negocio.telefone}
                  </span>
                )}
              </DialogDescription>
            </div>

            <div className="text-right shrink-0">
              <p className="text-[10px] font-mono uppercase font-semibold text-muted-foreground">Valor Total Negociado</p>
              <p className="text-2xl sm:text-3xl font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatBRL(negocio.valor)}
              </p>
            </div>
          </div>
        </div>

        {/* Corpo em 3 Colunas Horizontais Widescreen */}
        <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          {/* COLUNA 1: PRODUTO & CONDIÇÕES COMERCIAIS */}
          <div className="space-y-4 flex flex-col justify-between">
            {/* Produto & Equipamento */}
            <div className="rounded-xl border p-4 bg-black/[0.01] dark:bg-white/[0.01] flex-1 flex flex-col justify-between" style={{ borderColor: "var(--voux-card-border)" }}>
              <div>
                <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b text-xs font-mono font-semibold uppercase text-muted-foreground" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span className="flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-amber-500" />
                    Equipamento Negociado
                  </span>
                  {negocio.grupo_produto && negocio.grupo_produto !== "Outros" && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      {negocio.grupo_produto}
                    </span>
                  )}
                </div>

                <p className="text-sm font-bold text-foreground mb-3 leading-snug">
                  {negocio.produto}
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {negocio.marca && (
                    <div className="rounded-lg border p-2 bg-background/50" style={{ borderColor: "var(--voux-card-border)" }}>
                      <span className="text-[10px] text-muted-foreground block">Marca</span>
                      <span className="font-semibold text-foreground truncate block">{negocio.marca}</span>
                    </div>
                  )}
                  {negocio.modelo && (
                    <div className="rounded-lg border p-2 bg-background/50" style={{ borderColor: "var(--voux-card-border)" }}>
                      <span className="text-[10px] text-muted-foreground block">Modelo</span>
                      <span className="font-semibold text-foreground truncate block">{negocio.modelo}</span>
                    </div>
                  )}
                  <div className="rounded-lg border p-2 bg-background/50" style={{ borderColor: "var(--voux-card-border)" }}>
                    <span className="text-[10px] text-muted-foreground block">Condição</span>
                    <span className="font-semibold text-foreground">{negocio.condicao_produto || "Novo"}</span>
                  </div>
                  <div className="rounded-lg border p-2 bg-background/50" style={{ borderColor: "var(--voux-card-border)" }}>
                    <span className="text-[10px] text-muted-foreground block">Quantidade</span>
                    <span className="font-semibold text-foreground">{negocio.quantidade} un.</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t flex items-center justify-between text-xs font-mono" style={{ borderColor: "var(--voux-card-border)" }}>
                <span className="text-muted-foreground">Valor Unitário:</span>
                <span className="font-bold text-foreground">{formatBRL(negocio.valor_unitario)}</span>
              </div>
            </div>

            {/* Condição & Financiamento */}
            <div className="rounded-xl border p-4 bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
              <div className="flex items-center gap-1.5 mb-2 pb-2 border-b text-xs font-mono font-semibold uppercase text-muted-foreground" style={{ borderColor: "var(--voux-card-border)" }}>
                <CreditCard className="h-4 w-4 text-emerald-500" />
                <span>Condição & Financiamento</span>
              </div>

              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between py-0.5 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span className="text-muted-foreground">Origem Lead:</span>
                  <span className="font-semibold text-foreground">{negocio.forma_entrada || "Prospecção"}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span className="text-muted-foreground">Orçamento:</span>
                  <span className="font-semibold text-foreground">{negocio.orc_tipo || "Não especificado"}</span>
                </div>
                {negocio.orc_banco && (
                  <div className="flex justify-between py-0.5 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                    <span className="text-muted-foreground">Banco:</span>
                    <span className="font-semibold text-foreground">{negocio.orc_banco}</span>
                  </div>
                )}
                {negocio.orc_valor > 0 && (
                  <div className="flex justify-between py-0.5 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                    <span className="text-muted-foreground">Valor Orçado:</span>
                    <span className="font-semibold text-emerald-500">{formatBRL(negocio.orc_valor)}</span>
                  </div>
                )}
                {negocio.orc_observacao && (
                  <div className="pt-1 text-[11px] text-muted-foreground">
                    <span className="font-semibold block text-foreground">Obs. Financeira:</span>
                    <p className="line-clamp-2">{negocio.orc_observacao}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* COLUNA 2: TERMÔMETRO & TROCA NA MÁQUINA */}
          <div className="space-y-4 flex flex-col justify-between">
            {/* Card de Termômetro */}
            <div className="rounded-xl border p-4 bg-black/[0.015] dark:bg-white/[0.015] flex-1 flex flex-col justify-between" style={{ borderColor: "var(--voux-card-border)" }}>
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <Flame className="h-4 w-4 text-amber-500" />
                    <span className="font-mono text-xs font-bold text-foreground">
                      Termômetro de Fechamento
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-amber-500">
                    {termometro.probabilidade} prob.
                  </span>
                </div>

                {/* Barra de Temperatura */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10 mb-2">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", termometro.barColor)}
                    style={{ width: `${termometro.percent}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
                  {termometro.descricao}
                </p>
              </div>

              {/* Ciclo e Interações */}
              <div className="grid grid-cols-3 gap-2 pt-2.5 border-t text-xs font-mono" style={{ borderColor: "var(--voux-card-border)" }}>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Tempo no Funil</span>
                  <span className="font-bold text-foreground">{negocio.ciclo_vendas && Number(negocio.ciclo_vendas) > 0 ? `${negocio.ciclo_vendas}d` : "Recente"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Ações Totais</span>
                  <span className="font-bold text-foreground">{negocio.qtd_acoes || 0} ações</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">1º Contato</span>
                  <span className="font-bold text-foreground">{negocio.data_primeiro_contato ? formatDateBR(negocio.data_primeiro_contato) : "—"}</span>
                </div>
              </div>
            </div>

            {/* Máquina Usada na Troca & Datas */}
            <div className="rounded-xl border p-4 bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
              <div className="flex items-center gap-1.5 mb-2 pb-2 border-b text-xs font-mono font-semibold uppercase text-muted-foreground" style={{ borderColor: "var(--voux-card-border)" }}>
                <Truck className="h-4 w-4 text-blue-500" />
                <span>Máquina na Troca & Prazos</span>
              </div>

              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between py-0.5 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span className="text-muted-foreground">Máquina Troca:</span>
                  <span className="font-semibold text-foreground truncate max-w-[160px]" title={negocio.usa_maquina || "Nenhuma troca vinculada"}>
                    {negocio.usa_maquina || "Nenhuma troca"}
                  </span>
                </div>
                {negocio.usa_valor > 0 && (
                  <div className="flex justify-between py-0.5 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                    <span className="text-muted-foreground">Valor Avaliado:</span>
                    <span className="font-semibold text-foreground">{formatBRL(negocio.usa_valor)}</span>
                  </div>
                )}
                {negocio.usa_estado && (
                  <div className="flex justify-between py-0.5 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                    <span className="text-muted-foreground">Estado:</span>
                    <span className="font-semibold text-foreground">{negocio.usa_estado}</span>
                  </div>
                )}
                <div className="flex justify-between py-0.5 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span className="text-muted-foreground">Data Cadastro:</span>
                  <span className="font-semibold text-foreground">{negocio.data_cadastro ? formatDateBR(negocio.data_cadastro) : "—"}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">Previsão Fechamento:</span>
                  <span className="font-semibold text-amber-500">{negocio.data_previsao ? formatDateBR(negocio.data_previsao) : "A definir"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* COLUNA 3: NOTAS, HISTÓRICO DE CAMPO & CONTATO */}
          <div className="space-y-4 flex flex-col justify-between">
            {/* Notas do Negócio */}
            <div className="rounded-xl border p-4 bg-black/[0.01] dark:bg-white/[0.01] flex-1 flex flex-col" style={{ borderColor: "var(--voux-card-border)" }}>
              <div className="flex items-center gap-1.5 mb-2 pb-2 border-b text-xs font-mono font-semibold uppercase text-muted-foreground" style={{ borderColor: "var(--voux-card-border)" }}>
                <MessageSquare className="h-4 w-4 text-purple-500" />
                <span>Observações & Notas do CRM</span>
              </div>

              <div className="flex-1 space-y-2.5 text-xs">
                <div className="p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border leading-relaxed" style={{ borderColor: "var(--voux-card-border)" }}>
                  <p className="font-mono text-[10px] uppercase font-bold text-muted-foreground mb-1">Anotações do Deal:</p>
                  <p className="whitespace-pre-line text-foreground line-clamp-4">
                    {negocio.observacao || "Nenhuma observação cadastrada no negócio."}
                  </p>
                </div>

                {negocio.obs_ultima_acao && (
                  <div className="p-3 rounded-lg bg-amber-500/[0.04] border border-amber-500/25 leading-relaxed">
                    <p className="font-mono text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 mb-1">Última Ação de Campo:</p>
                    <p className="whitespace-pre-line text-foreground line-clamp-3">
                      {negocio.obs_ultima_acao}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Contato Rápido */}
            <div className="flex items-center justify-between p-3 rounded-xl border bg-black/[0.015] dark:bg-white/[0.015]" style={{ borderColor: "var(--voux-card-border)" }}>
              <div className="flex items-center gap-2 min-w-0">
                <Phone className="h-4 w-4 text-emerald-500 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] font-mono text-muted-foreground block">Telefone Principal</span>
                  <span className="text-xs font-mono font-bold text-foreground truncate block">{negocio.telefone || "Não informado"}</span>
                </div>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground border px-2 py-0.5 rounded-full bg-background">
                {negocio.cidade || "Praça Ativa"}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});
