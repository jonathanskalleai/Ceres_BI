import { memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Flame,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Clock,
  Building2,
  FileText,
  CreditCard,
  Truck,
  Calendar,
  Mail,
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

function cleanProductName(raw: string | null | undefined): string {
  if (!raw) return "Produto não especificado";
  return raw.split(/\s*-\s*Descri[cç][aã]o adicional/i)[0].trim();
}

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

function formatCpfCnpj(doc: string | null | undefined): string {
  if (!doc) return "";
  const cleaned = doc.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
  }
  if (cleaned.length === 14) {
    return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12)}`;
  }
  return doc;
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
        label: "5/5 ★ Quentíssimo (100% prob.)",
        probabilidade: "100%",
        badgeBg: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",
        stars: "★★★★★",
        descricao: "Negócio com altíssima probabilidade de fechamento a curto prazo.",
      };
    case 4:
      return {
        label: "4/5 ★ Alta Probabilidade (80% prob.)",
        probabilidade: "80%",
        badgeBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
        stars: "★★★★☆",
        descricao: "Proposta aceita em princípio, em fase de aprovação de crédito ou documentação.",
      };
    case 3:
      return {
        label: "3/5 ★ Probabilidade Média (60% prob.)",
        probabilidade: "60%",
        badgeBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
        stars: "★★★☆☆",
        descricao: "Cliente demonstrando interesse real, cotações e simulações em andamento.",
      };
    case 2:
      return {
        label: "2/5 ★ Baixa Probabilidade (40% prob.)",
        probabilidade: "40%",
        badgeBg: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
        stars: "★★☆☆☆",
        descricao: "Primeiras sondagens de preço e verificação de disponibilidade.",
      };
    case 1:
      return {
        label: "1/5 ★ Prospecção Inicial (20% prob.)",
        probabilidade: "20%",
        badgeBg: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
        stars: "★☆☆☆☆",
        descricao: "Contato inicial realizado, aguardando levantamento de necessidade.",
      };
    default:
      return {
        label: "Sem estrelas definidas",
        probabilidade: "—",
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
  const produtoLimpo = cleanProductName(negocio.produto);
  const telefoneFormatado = formatPhone(negocio.telefone);
  const docFormatado = formatCpfCnpj(negocio.cnpj_cpf);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[96vw] max-w-6xl max-h-[95vh] overflow-y-auto rounded-2xl border p-0 gap-0"
        style={{
          background: "var(--surface-raised)",
          borderColor: "var(--voux-card-border)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* ======================================================== */}
        {/* CABEÇALHO DO CLIENTE & VALOR NEGOCIADO */}
        {/* ======================================================== */}
        <div
          className="px-5 py-4 border-b space-y-2.5"
          style={{ borderColor: "var(--voux-card-border)", background: "rgba(0,0,0,0.02)" }}
        >
          {/* Linha 1: Badges de Etapa + Termômetro Compacto + ID */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border", etapaBadge.bg)}>
                {etapaBadge.label}
              </span>

              {/* Termômetro Compacto */}
              <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border", termometro.badgeBg)} title={termometro.descricao}>
                <Flame className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="tracking-wider text-amber-500">{termometro.stars}</span>
                <span>{termometro.label}</span>
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

          {/* Linha 2: NOME DO CLIENTE (Destaque Principal) & VALOR TOTAL */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-amber-500 shrink-0" />
                <DialogTitle
                  className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate"
                  style={{ fontFamily: "var(--voux-font-display)" }}
                >
                  {negocio.cliente}
                </DialogTitle>
              </div>

              {/* Dados do Cliente: Cidade, Documento, Telefone e Tempo no Funil */}
              <DialogDescription className="text-xs font-mono text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                {negocio.cidade && (
                  <span className="flex items-center gap-1 text-foreground font-medium">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    {negocio.cidade} {negocio.uf ? `(${negocio.uf})` : ""}
                  </span>
                )}
                {docFormatado && (
                  <span>CPF/CNPJ: {docFormatado}</span>
                )}
                {telefoneFormatado && (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <Phone className="h-3 w-3" />
                    {telefoneFormatado}
                  </span>
                )}
                {negocio.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    {negocio.email}
                  </span>
                )}
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <Clock className="h-3 w-3" />
                  {negocio.ciclo_vendas && Number(negocio.ciclo_vendas) > 0 ? `${negocio.ciclo_vendas} dias no funil` : "Lead recente"}
                </span>
                <span>· {negocio.qtd_acoes || 0} ações</span>
              </DialogDescription>
            </div>

            {/* Valor Total Negociado */}
            <div className="sm:text-right shrink-0 bg-emerald-500/[0.05] dark:bg-emerald-500/[0.1] border border-emerald-500/20 rounded-xl px-4 py-2">
              <p className="text-[10px] font-mono uppercase font-semibold text-muted-foreground">Valor Total Negociado</p>
              <p className="text-xl sm:text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatBRL(negocio.valor)}
              </p>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* CORPO DO MODAL EM 3 COLUNAS HORIZONTAIS COMPACTAS */}
        {/* ======================================================== */}
        <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-3 gap-3.5 items-stretch">
          {/* ======================================================== */}
          {/* COLUNA 1: EQUIPAMENTO & PRODUTO NEGOCIADO */}
          {/* ======================================================== */}
          <div className="space-y-3 flex flex-col justify-between">
            {/* Card Produto */}
            <div className="rounded-xl border p-3.5 bg-black/[0.01] dark:bg-white/[0.01] flex-1 flex flex-col justify-between" style={{ borderColor: "var(--voux-card-border)" }}>
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

                <p className="text-[13px] font-bold text-foreground mb-2.5 leading-snug" title={negocio.produto}>
                  {produtoLimpo}
                </p>

                <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                  {negocio.marca && (
                    <div className="rounded-lg border p-1.5 bg-background/50" style={{ borderColor: "var(--voux-card-border)" }}>
                      <span className="text-[10px] text-muted-foreground block">Marca</span>
                      <span className="font-semibold text-foreground truncate block">{negocio.marca}</span>
                    </div>
                  )}
                  {negocio.modelo && (
                    <div className="rounded-lg border p-1.5 bg-background/50" style={{ borderColor: "var(--voux-card-border)" }}>
                      <span className="text-[10px] text-muted-foreground block">Modelo</span>
                      <span className="font-semibold text-foreground truncate block">{negocio.modelo}</span>
                    </div>
                  )}
                  <div className="rounded-lg border p-1.5 bg-background/50" style={{ borderColor: "var(--voux-card-border)" }}>
                    <span className="text-[10px] text-muted-foreground block">Condição</span>
                    <span className="font-semibold text-foreground">{negocio.condicao_produto || "Novo"}</span>
                  </div>
                  <div className="rounded-lg border p-1.5 bg-background/50" style={{ borderColor: "var(--voux-card-border)" }}>
                    <span className="text-[10px] text-muted-foreground block">Quantidade</span>
                    <span className="font-semibold text-foreground">{negocio.quantidade} un.</span>
                  </div>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t flex items-center justify-between text-xs font-mono" style={{ borderColor: "var(--voux-card-border)" }}>
                <span className="text-muted-foreground">Valor Unitário:</span>
                <span className="font-bold text-foreground">{formatBRL(negocio.valor_unitario)}</span>
              </div>
            </div>

            {/* Origem Lead & Datas */}
            <div className="rounded-xl border p-3 bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
              <div className="space-y-1 text-xs font-mono">
                <div className="flex items-center justify-between py-0.5 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span className="text-muted-foreground">Origem Lead:</span>
                  <span className="font-semibold text-foreground">{negocio.forma_entrada || "Prospecção"}</span>
                </div>
                <div className="flex items-center justify-between py-0.5 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span className="text-muted-foreground">Data Cadastro:</span>
                  <span className="font-semibold text-foreground">{negocio.data_cadastro ? formatDateBR(negocio.data_cadastro) : "—"}</span>
                </div>
                {negocio.data_primeiro_contato && (
                  <div className="flex items-center justify-between py-0.5 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                    <span className="text-muted-foreground">1º Contato:</span>
                    <span className="font-semibold text-foreground">{formatDateBR(negocio.data_primeiro_contato)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-muted-foreground">Previsão Fechamento:</span>
                  <span className="font-semibold text-amber-500">{negocio.data_previsao ? formatDateBR(negocio.data_previsao) : "A definir"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* COLUNA 2: CONDIÇÃO COMERCIAL, FINANCIAMENTO & TROCA */}
          {/* ======================================================== */}
          <div className="space-y-3 flex flex-col justify-between">
            {/* Card Financiamento */}
            <div className="rounded-xl border p-3.5 bg-black/[0.01] dark:bg-white/[0.01] flex-1 flex flex-col justify-between" style={{ borderColor: "var(--voux-card-border)" }}>
              <div>
                <div className="flex items-center gap-1.5 mb-2 pb-2 border-b text-xs font-mono font-semibold uppercase text-muted-foreground" style={{ borderColor: "var(--voux-card-border)" }}>
                  <CreditCard className="h-4 w-4 text-emerald-500" />
                  <span>Condição & Financiamento</span>
                </div>

                <div className="space-y-1.5 text-xs font-mono">
                  <div className="flex items-center justify-between py-0.5 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                    <span className="text-muted-foreground">Tipo Orçamento:</span>
                    <span className="font-semibold text-foreground">{negocio.orc_tipo || "Não especificado"}</span>
                  </div>
                  {negocio.orc_banco && (
                    <div className="flex items-center justify-between py-0.5 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                      <span className="text-muted-foreground">Banco / Agente:</span>
                      <span className="font-semibold text-foreground">{negocio.orc_banco}</span>
                    </div>
                  )}
                  {negocio.orc_valor > 0 && (
                    <div className="flex items-center justify-between py-0.5 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                      <span className="text-muted-foreground">Valor Orçado:</span>
                      <span className="font-semibold text-emerald-500">{formatBRL(negocio.orc_valor)}</span>
                    </div>
                  )}
                  {negocio.orc_observacao && (
                    <div className="pt-1 text-[11px] text-muted-foreground">
                      <span className="font-semibold block text-foreground mb-0.5">Obs. Financiamento:</span>
                      <p className="line-clamp-2 leading-relaxed bg-black/[0.02] dark:bg-white/[0.02] p-1.5 rounded border border-black/5 dark:border-white/5">
                        {negocio.orc_observacao}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Card Máquina Usada na Troca */}
            <div className="rounded-xl border p-3.5 bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
              <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b text-xs font-mono font-semibold uppercase text-muted-foreground" style={{ borderColor: "var(--voux-card-border)" }}>
                <Truck className="h-4 w-4 text-blue-500" />
                <span>Máquina na Troca</span>
              </div>

              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex items-center justify-between py-0.5 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span className="text-muted-foreground">Máquina Usada:</span>
                  <span className="font-semibold text-foreground text-right max-w-[160px] truncate" title={negocio.usa_maquina || "Nenhuma troca vinculada"}>
                    {negocio.usa_maquina || "Nenhuma troca"}
                  </span>
                </div>
                {negocio.usa_valor > 0 && (
                  <div className="flex items-center justify-between py-0.5 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                    <span className="text-muted-foreground">Valor Troca:</span>
                    <span className="font-semibold text-foreground">{formatBRL(negocio.usa_valor)}</span>
                  </div>
                )}
                {negocio.usa_estado && (
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-muted-foreground">Estado:</span>
                    <span className="font-semibold text-foreground">{negocio.usa_estado}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* COLUNA 3: HISTÓRICO, NOTAS & CAMPO */}
          {/* ======================================================== */}
          <div className="space-y-3 flex flex-col justify-between">
            {/* Notas do Negócio */}
            <div className="rounded-xl border p-3.5 bg-black/[0.01] dark:bg-white/[0.01] flex-1 flex flex-col" style={{ borderColor: "var(--voux-card-border)" }}>
              <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b text-xs font-mono font-semibold uppercase text-muted-foreground" style={{ borderColor: "var(--voux-card-border)" }}>
                <MessageSquare className="h-4 w-4 text-purple-500" />
                <span>Observações & Notas do CRM</span>
              </div>

              <div className="flex-1 space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border leading-relaxed" style={{ borderColor: "var(--voux-card-border)" }}>
                  <p className="font-mono text-[10px] uppercase font-bold text-muted-foreground mb-1">Anotações do Deal:</p>
                  <p className="whitespace-pre-line text-foreground line-clamp-4 text-[12px] leading-relaxed">
                    {negocio.observacao || "Nenhuma observação cadastrada no negócio."}
                  </p>
                </div>

                {negocio.obs_ultima_acao && (
                  <div className="p-2.5 rounded-lg bg-amber-500/[0.04] border border-amber-500/25 leading-relaxed">
                    <p className="font-mono text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 mb-0.5">Última Ação de Campo:</p>
                    <p className="whitespace-pre-line text-foreground line-clamp-3 text-[12px] leading-relaxed">
                      {negocio.obs_ultima_acao}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Termômetro Explicativo Compacto */}
            <div className="rounded-xl border p-2.5 bg-black/[0.015] dark:bg-white/[0.015] flex items-center justify-between gap-2 text-xs" style={{ borderColor: "var(--voux-card-border)" }}>
              <div className="flex items-center gap-2 min-w-0">
                <Flame className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="text-[11px] text-muted-foreground truncate">
                  {termometro.descricao}
                </span>
              </div>
              <span className="font-mono font-bold text-amber-500 shrink-0 text-xs">
                {termometro.probabilidade}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});
