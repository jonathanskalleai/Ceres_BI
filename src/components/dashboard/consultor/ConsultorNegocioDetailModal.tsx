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
  if (count >= 4) {
    return {
      label: `${count}/5 ★ Alta Probabilidade (Quente)`,
      color: "text-emerald-500",
      badgeBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      stars: "★".repeat(count) + "☆".repeat(5 - count),
    };
  }
  if (count === 3) {
    return {
      label: "3/5 ★ Probabilidade Média (Morno)",
      color: "text-amber-500",
      badgeBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      stars: "★★★☆☆",
    };
  }
  if (count > 0) {
    return {
      label: `${count}/5 ★ Baixa Probabilidade (Frio)`,
      color: "text-rose-500",
      badgeBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      stars: "★".repeat(count) + "☆".repeat(5 - count),
    };
  }
  return {
    label: "Sem estrelas definidas",
    color: "text-muted-foreground",
    badgeBg: "bg-muted text-muted-foreground border-border",
    stars: "☆☆☆☆☆",
  };
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
        className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border p-0 gap-0"
        style={{
          background: "var(--surface-raised)",
          borderColor: "var(--voux-card-border)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
        }}
      >
        {/* Header do Modal */}
        <div className="p-6 border-b space-y-3" style={{ borderColor: "var(--voux-card-border)", background: "rgba(0,0,0,0.02)" }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border", etapaBadge.bg)}>
                {etapaBadge.label}
              </span>
              <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border", termometro.badgeBg)}>
                <Flame className="h-3.5 w-3.5" />
                <span className="tracking-widest">{termometro.stars}</span>
                <span>({negocio.estrelas || 0}★)</span>
              </span>
            </div>

            <span className="text-xs font-mono text-muted-foreground">
              Registro #{negocio.numero}
            </span>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <DialogTitle
                className="text-xl sm:text-2xl font-bold tracking-tight text-foreground"
                style={{ fontFamily: "var(--voux-font-display)" }}
              >
                {negocio.cliente}
              </DialogTitle>
              <DialogDescription className="text-xs font-mono text-muted-foreground flex items-center gap-2 mt-1">
                {negocio.cidade && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {negocio.cidade} {negocio.uf ? `· ${negocio.uf}` : ""}
                  </span>
                )}
                {negocio.cnpj_cpf && (
                  <span>· CPF/CNPJ: {negocio.cnpj_cpf}</span>
                )}
              </DialogDescription>
            </div>

            <div className="text-right">
              <p className="text-[11px] font-mono uppercase font-semibold text-muted-foreground">Valor Total Negociado</p>
              <p className="text-2xl sm:text-3xl font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatBRL(negocio.valor)}
              </p>
            </div>
          </div>
        </div>

        {/* Corpo com Grid de Informações */}
        <div className="p-6 space-y-5">
          {/* Seção 1: Produto / Equipamento Negociado */}
          <div className="rounded-xl border p-4 bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
            <div className="flex items-center gap-2 mb-2 pb-2 border-b text-xs font-mono font-semibold uppercase text-muted-foreground" style={{ borderColor: "var(--voux-card-border)" }}>
              <Package className="h-4 w-4 text-amber-500" />
              <span>Equipamento & Produto Negociado</span>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-bold text-foreground">
                {negocio.produto}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs font-mono">
                {negocio.marca && (
                  <div className="rounded-lg border p-2 bg-background/50" style={{ borderColor: "var(--voux-card-border)" }}>
                    <span className="text-[10px] text-muted-foreground block">Marca</span>
                    <span className="font-semibold text-foreground">{negocio.marca}</span>
                  </div>
                )}
                {negocio.modelo && (
                  <div className="rounded-lg border p-2 bg-background/50" style={{ borderColor: "var(--voux-card-border)" }}>
                    <span className="text-[10px] text-muted-foreground block">Modelo</span>
                    <span className="font-semibold text-foreground">{negocio.modelo}</span>
                  </div>
                )}
                <div className="rounded-lg border p-2 bg-background/50" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span className="text-[10px] text-muted-foreground block">Quantidade</span>
                  <span className="font-semibold text-foreground">{negocio.quantidade} un.</span>
                </div>
                <div className="rounded-lg border p-2 bg-background/50" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span className="text-[10px] text-muted-foreground block">Valor Unitário</span>
                  <span className="font-semibold text-foreground">{formatBRL(negocio.valor_unitario)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Seção 2: Condições Comerciais, Financiamento e Trocas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Condições Financeiras */}
            <div className="rounded-xl border p-4 bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
              <div className="flex items-center gap-2 mb-2 pb-2 border-b text-xs font-mono font-semibold uppercase text-muted-foreground" style={{ borderColor: "var(--voux-card-border)" }}>
                <CreditCard className="h-4 w-4 text-emerald-500" />
                <span>Condição & Financiamento</span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between py-1 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span className="text-muted-foreground">Forma de Entrada:</span>
                  <span className="font-semibold text-foreground">{negocio.forma_entrada || "Prospecção"}</span>
                </div>
                <div className="flex justify-between py-1 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span className="text-muted-foreground">Tipo de Orçamento:</span>
                  <span className="font-semibold text-foreground">{negocio.orc_tipo || "Não especificado"}</span>
                </div>
                {negocio.orc_banco && negocio.orc_banco.trim() && (
                  <div className="flex justify-between py-1 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                    <span className="text-muted-foreground">Banco / Agente:</span>
                    <span className="font-semibold text-foreground">{negocio.orc_banco}</span>
                  </div>
                )}
                {negocio.orc_valor > 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Valor Orçado:</span>
                    <span className="font-semibold text-emerald-500">{formatBRL(negocio.orc_valor)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Máquina Usada na Troca & Previsões */}
            <div className="rounded-xl border p-4 bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
              <div className="flex items-center gap-2 mb-2 pb-2 border-b text-xs font-mono font-semibold uppercase text-muted-foreground" style={{ borderColor: "var(--voux-card-border)" }}>
                <Truck className="h-4 w-4 text-blue-500" />
                <span>Máquina na Troca & Datas</span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between py-1 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span className="text-muted-foreground">Máquina Usada:</span>
                  <span className="font-semibold text-foreground truncate max-w-[180px]" title={negocio.usa_maquina || "Nenhuma troca vinculada"}>
                    {negocio.usa_maquina || "Nenhuma troca vinculada"}
                  </span>
                </div>
                {negocio.usa_valor > 0 && (
                  <div className="flex justify-between py-1 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                    <span className="text-muted-foreground">Valor da Troca:</span>
                    <span className="font-semibold text-foreground">{formatBRL(negocio.usa_valor)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span className="text-muted-foreground">Data Cadastro:</span>
                  <span className="font-semibold text-foreground">{negocio.data_cadastro ? formatDateBR(negocio.data_cadastro) : "—"}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Previsão Fechamento:</span>
                  <span className="font-semibold text-amber-500">{negocio.data_previsao ? formatDateBR(negocio.data_previsao) : "A definir"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Seção 3: Observações Detalhadas do Negócio */}
          <div className="rounded-xl border p-4 bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
            <div className="flex items-center gap-2 mb-2 pb-2 border-b text-xs font-mono font-semibold uppercase text-muted-foreground" style={{ borderColor: "var(--voux-card-border)" }}>
              <MessageSquare className="h-4 w-4 text-purple-500" />
              <span>Observações & Histórico da Negociação</span>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <div className="p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border" style={{ borderColor: "var(--voux-card-border)" }}>
                <p className="font-mono text-[11px] uppercase font-bold text-muted-foreground mb-1">Notas do Negócio:</p>
                <p className="whitespace-pre-line text-foreground">
                  {negocio.observacao || "Nenhuma observação cadastrada no negócio."}
                </p>
              </div>

              {negocio.obs_ultima_acao && (
                <div className="p-3 rounded-lg bg-amber-500/[0.04] border border-amber-500/20">
                  <p className="font-mono text-[11px] uppercase font-bold text-amber-600 dark:text-amber-400 mb-1">Última Ação de Campo:</p>
                  <p className="whitespace-pre-line text-foreground">
                    {negocio.obs_ultima_acao}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Seção 4: Contato com o Cliente */}
          {negocio.telefone && (
            <div className="flex items-center gap-2 p-3 rounded-xl border bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-mono text-muted-foreground">Telefone de Contato:</span>
              <span className="text-xs font-mono font-bold text-foreground">{negocio.telefone}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});
