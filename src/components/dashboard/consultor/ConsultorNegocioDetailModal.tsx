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
        className="w-[96vw] max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl border p-0 gap-0"
        style={{
          background: "var(--surface-raised)",
          borderColor: "var(--voux-card-border)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* ======================================================== */}
        {/* CABEÇALHO PRINCIPAL COM EQUIPAMENTO & VALOR NEGOCIADO */}
        {/* ======================================================== */}
        <div
          className="p-5 sm:p-6 border-b space-y-3"
          style={{ borderColor: "var(--voux-card-border)", background: "rgba(0,0,0,0.02)" }}
        >
          {/* Linha 1: Badges de Etapa + Termômetro Compacto + ID */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border", etapaBadge.bg)}>
                {etapaBadge.label}
              </span>

              {/* Termômetro Compacto (Sem ocupar card inteiro) */}
              <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border", termometro.badgeBg)} title={termometro.descricao}>
                <Flame className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="tracking-wider text-amber-500">{termometro.stars}</span>
                <span>{termometro.probabilidade} prob.</span>
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

          {/* Linha 2: EQUIPAMENTO NEGOCIADO (Destaque Principal) & VALOR TOTAL */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-amber-500 shrink-0" />
                <DialogTitle
                  className="text-xl sm:text-2xl font-bold tracking-tight text-foreground"
                  style={{ fontFamily: "var(--voux-font-display)" }}
                >
                  {negocio.produto}
                </DialogTitle>
              </div>

              {/* Tags do Equipamento */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {negocio.grupo_produto && negocio.grupo_produto !== "Outros" && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    {negocio.grupo_produto}
                  </span>
                )}
                {negocio.marca && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-black/[0.04] dark:bg-white/[0.05] text-foreground border" style={{ borderColor: "var(--voux-card-border)" }}>
                    Marca: <strong>{negocio.marca}</strong>
                  </span>
                )}
                {negocio.modelo && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-black/[0.04] dark:bg-white/[0.05] text-foreground border" style={{ borderColor: "var(--voux-card-border)" }}>
                    Modelo: <strong>{negocio.modelo}</strong>
                  </span>
                )}
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                  {negocio.condicao_produto || "Novo"}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono text-muted-foreground border" style={{ borderColor: "var(--voux-card-border)" }}>
                  {negocio.quantidade} un. · Unit.: {formatBRL(negocio.valor_unitario)}
                </span>
              </div>
            </div>

            {/* Valor Total Negociado */}
            <div className="sm:text-right shrink-0 bg-emerald-500/[0.05] dark:bg-emerald-500/[0.1] border border-emerald-500/20 rounded-xl px-4 py-2.5">
              <p className="text-[10px] font-mono uppercase font-semibold text-muted-foreground">Valor Total Negociado</p>
              <p className="text-2xl sm:text-3xl font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatBRL(negocio.valor)}
              </p>
            </div>
          </div>

          {/* Linha 3: DADOS DO CLIENTE & TEMPO NO FUNIL */}
          <div className="pt-2 border-t flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs font-mono text-muted-foreground" style={{ borderColor: "var(--voux-card-border)" }}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                {negocio.cliente}
              </span>
              {negocio.cidade && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  {negocio.cidade} {negocio.uf ? `(${negocio.uf})` : ""}
                </span>
              )}
              {negocio.cnpj_cpf && <span>· CPF/CNPJ: {negocio.cnpj_cpf}</span>}
              {negocio.telefone && (
                <span className="flex items-center gap-1 text-foreground font-semibold">
                  <Phone className="h-3 w-3 text-emerald-500" />
                  {negocio.telefone}
                </span>
              )}
            </div>

            {/* Ciclo de Vendas e Ações */}
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-foreground">
                <Clock className="h-3 w-3 text-amber-500" />
                {negocio.ciclo_vendas && Number(negocio.ciclo_vendas) > 0 ? `${negocio.ciclo_vendas} dias no funil` : "Lead recente"}
              </span>
              <span>· {negocio.qtd_acoes || 0} ações registradas</span>
              {negocio.data_primeiro_contato && <span>· 1º contato: {formatDateBR(negocio.data_primeiro_contato)}</span>}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* CORPO DO MODAL EM 2 COLUNAS AMPLAS E ESPAÇOSAS */}
        {/* ======================================================== */}
        <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* ======================================================== */}
          {/* COLUNA ESQUERDA (5 Colunas): CONDIÇÕES, TROCA & DATAS */}
          {/* ======================================================== */}
          <div className="lg:col-span-5 space-y-4">
            {/* Card 1: Condição de Pagamento & Financiamento */}
            <div className="rounded-xl border p-4 bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
              <div className="flex items-center gap-1.5 mb-3 pb-2 border-b text-xs font-mono font-semibold uppercase text-muted-foreground" style={{ borderColor: "var(--voux-card-border)" }}>
                <CreditCard className="h-4 w-4 text-emerald-500" />
                <span>Condição Comercial & Financiamento</span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between py-1 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span className="text-muted-foreground">Forma de Entrada / Lead:</span>
                  <span className="font-semibold text-foreground">{negocio.forma_entrada || "Prospecção"}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span className="text-muted-foreground">Tipo de Orçamento:</span>
                  <span className="font-semibold text-foreground">{negocio.orc_tipo || "Não especificado"}</span>
                </div>
                {negocio.orc_banco && (
                  <div className="flex items-center justify-between py-1 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                    <span className="text-muted-foreground">Banco / Agente:</span>
                    <span className="font-semibold text-foreground">{negocio.orc_banco}</span>
                  </div>
                )}
                {negocio.orc_valor > 0 && (
                  <div className="flex items-center justify-between py-1 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                    <span className="text-muted-foreground">Valor Orçado:</span>
                    <span className="font-semibold text-emerald-500">{formatBRL(negocio.orc_valor)}</span>
                  </div>
                )}
                {negocio.orc_observacao && (
                  <div className="pt-1.5 text-[11px] text-muted-foreground">
                    <span className="font-semibold block text-foreground mb-0.5">Obs. de Financiamento:</span>
                    <p className="leading-relaxed bg-black/[0.02] dark:bg-white/[0.02] p-2 rounded-lg border border-black/5 dark:border-white/5">
                      {negocio.orc_observacao}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Máquina na Troca & Prazos */}
            <div className="rounded-xl border p-4 bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
              <div className="flex items-center gap-1.5 mb-3 pb-2 border-b text-xs font-mono font-semibold uppercase text-muted-foreground" style={{ borderColor: "var(--voux-card-border)" }}>
                <Truck className="h-4 w-4 text-blue-500" />
                <span>Máquina na Troca & Cronograma</span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between py-1 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span className="text-muted-foreground">Máquina Usada:</span>
                  <span className="font-semibold text-foreground text-right max-w-[200px] truncate" title={negocio.usa_maquina || "Nenhuma troca vinculada"}>
                    {negocio.usa_maquina || "Nenhuma troca vinculada"}
                  </span>
                </div>
                {negocio.usa_valor > 0 && (
                  <div className="flex items-center justify-between py-1 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                    <span className="text-muted-foreground">Valor da Troca:</span>
                    <span className="font-semibold text-foreground">{formatBRL(negocio.usa_valor)}</span>
                  </div>
                )}
                {negocio.usa_estado && (
                  <div className="flex items-center justify-between py-1 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                    <span className="text-muted-foreground">Estado de Conservação:</span>
                    <span className="font-semibold text-foreground">{negocio.usa_estado}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-1 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span className="text-muted-foreground">Data de Cadastro:</span>
                  <span className="font-semibold text-foreground">{negocio.data_cadastro ? formatDateBR(negocio.data_cadastro) : "—"}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Previsão Fechamento:</span>
                  <span className="font-semibold text-amber-500">{negocio.data_previsao ? formatDateBR(negocio.data_previsao) : "A definir"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* COLUNA DIREITA (7 Colunas): HISTÓRICO, NOTAS & CAMPO */}
          {/* ======================================================== */}
          <div className="lg:col-span-7 space-y-4">
            {/* Card: Observações & Anotações do Deal */}
            <div className="rounded-xl border p-4 bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
              <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b text-xs font-mono font-semibold uppercase text-muted-foreground" style={{ borderColor: "var(--voux-card-border)" }}>
                <MessageSquare className="h-4 w-4 text-purple-500" />
                <span>Observações & Histórico do CRM</span>
              </div>

              <div className="p-3.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border leading-relaxed text-xs" style={{ borderColor: "var(--voux-card-border)" }}>
                <p className="font-mono text-[10px] uppercase font-bold text-muted-foreground mb-1.5">Notas do Negócio:</p>
                <p className="whitespace-pre-line text-foreground text-[13px] leading-relaxed">
                  {negocio.observacao || "Nenhuma observação cadastrada para este negócio."}
                </p>
              </div>
            </div>

            {/* Card: Última Ação de Campo */}
            {negocio.obs_ultima_acao && (
              <div className="rounded-xl border p-4 bg-amber-500/[0.03] dark:bg-amber-500/[0.05] border-amber-500/20">
                <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-amber-500/20 text-xs font-mono font-semibold uppercase text-amber-600 dark:text-amber-400">
                  <FileText className="h-4 w-4" />
                  <span>Última Ação de Campo Registrada</span>
                </div>
                <p className="whitespace-pre-line text-foreground text-xs sm:text-[13px] leading-relaxed p-2.5 rounded-lg bg-background/50 border border-amber-500/10">
                  {negocio.obs_ultima_acao}
                </p>
              </div>
            )}

            {/* Card Discreto de Probabilidade & Termômetro Explicativo */}
            <div className="rounded-xl border p-3.5 bg-black/[0.015] dark:bg-white/[0.015] flex items-center justify-between gap-3 text-xs" style={{ borderColor: "var(--voux-card-border)" }}>
              <div className="flex items-center gap-2 min-w-0">
                <Flame className="h-4 w-4 text-amber-500 shrink-0" />
                <div className="min-w-0">
                  <span className="font-mono font-bold text-foreground block truncate">
                    Termômetro: {termometro.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground block truncate">
                    {termometro.descricao}
                  </span>
                </div>
              </div>
              <span className="font-mono font-bold text-amber-500 shrink-0 text-sm">
                {termometro.probabilidade}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});
