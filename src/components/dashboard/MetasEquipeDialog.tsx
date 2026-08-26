import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Save, Target, WandSparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  CURVA_MENSAL_PADRAO,
  fetchConfiguracaoMetas,
  salvarConfiguracaoMetas,
} from "@/services/metasService";
import type { MetaConsultorAnual, MetaCurvaMensal } from "@/types/equipeDesempenho";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONEY_FORMATTER = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const INPUT_NUMBER_FORMATTER = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NUMBER_FORMATTER = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

interface MetasEquipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ano: number;
  consultores: string[];
}

function toNumber(value: string): number {
  const hasBrazilianDecimal = value.includes(",");
  const hasGroupedThousands = /^-?\d{1,3}(\.\d{3})+$/.test(value.trim());
  const normalized = hasBrazilianDecimal || hasGroupedThousands
    ? value.replace(/\./g, "").replace(",", ".")
    : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function inputValue(value: number): string {
  return value === 0 ? "" : INPUT_NUMBER_FORMATTER.format(value);
}

function money(value: number): string {
  return MONEY_FORMATTER.format(value);
}

function percentage(value: number): string {
  return `${NUMBER_FORMATTER.format(value)}%`;
}

function formatInputNumber(value: string): string {
  const parsed = toNumber(value);
  return parsed === 0 && value.trim() === "" ? "" : INPUT_NUMBER_FORMATTER.format(parsed);
}

function formatLiveNumber(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const negative = trimmed.startsWith("-");
  const withoutSign = trimmed.replace(/^-/, "");
  const commaIndex = withoutSign.lastIndexOf(",");
  const hasDecimal = commaIndex >= 0;
  const integerPart = hasDecimal ? withoutSign.slice(0, commaIndex) : withoutSign;
  const decimalPart = hasDecimal ? withoutSign.slice(commaIndex + 1).replace(/\D/g, "").slice(0, 2) : "";
  const digits = integerPart.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  const grouped = (digits || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `${negative ? "-" : ""}${grouped}${hasDecimal ? `,${decimalPart}` : ""}`;
}

export function MetasEquipeDialog({ open, onOpenChange, ano, consultores }: MetasEquipeDialogProps) {
  const queryClient = useQueryClient();
  const [metaAnual, setMetaAnual] = useState("");
  const [percentuais, setPercentuais] = useState<string[]>(CURVA_MENSAL_PADRAO.map((item) => String(item.percentual)));
  const [metasConsultores, setMetasConsultores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setError(null);
    setLoading(true);

    fetchConfiguracaoMetas(ano, consultores)
      .then((config) => {
        if (!active) return;
        setMetaAnual(inputValue(config.metaAnual));
        setPercentuais(config.curvaMensal.map((item) => String(item.percentual)));
        setMetasConsultores(
          Object.fromEntries(config.consultores.map((item) => [item.consultor, inputValue(item.metaAnual)])),
        );
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as metas.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [ano, consultores, open]);

  const metaAnualValue = toNumber(metaAnual);
  const percentuaisValue = useMemo(() => percentuais.map(toNumber), [percentuais]);
  const percentualTotal = percentuaisValue.reduce((sum, value) => sum + value, 0);
  const consultorValues = useMemo<MetaConsultorAnual[]>(
    () => consultores.map((consultor) => ({ consultor, metaAnual: toNumber(metasConsultores[consultor] ?? "") })),
    [consultores, metasConsultores],
  );
  const totalDistribuido = consultorValues.reduce((sum, item) => sum + item.metaAnual, 0);
  const saldo = metaAnualValue - totalDistribuido;
  const percentualDistribuido = metaAnualValue > 0 ? (totalDistribuido / metaAnualValue) * 100 : 0;
  const curvaValida = Math.abs(percentualTotal - 100) <= 0.01;
  const metaValida = metaAnualValue > 0;
  const podeSalvar = metaValida && curvaValida && !loading && !saving;

  const metasMensaisEmpresa = percentuaisValue.map((percentual) => metaAnualValue * percentual / 100);

  const atualizarPercentual = (index: number, value: string) => {
    setPercentuais((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));
  };

  const atualizarMetaConsultor = (consultor: string, value: string) => {
    setMetasConsultores((current) => ({ ...current, [consultor]: value }));
  };

  const usarCurvaPadrao = () => {
    setPercentuais(CURVA_MENSAL_PADRAO.map((item) => String(item.percentual)));
  };

  const salvar = async () => {
    if (!metaValida) {
      setError("Informe uma meta anual da empresa maior que zero.");
      return;
    }
    if (!curvaValida) {
      setError(`A curva mensal precisa totalizar 100%. Atualmente está em ${percentage(percentualTotal)}.`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const curvaMensal: MetaCurvaMensal[] = percentuaisValue.map((percentual, index) => ({
        mes: index + 1,
        percentual,
      }));
      await salvarConfiguracaoMetas({
        ano,
        metaAnual: metaAnualValue,
        curvaMensal,
        consultores: consultorValues,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rpc", "equipe-desempenho-mensal"] }),
        queryClient.invalidateQueries({ queryKey: ["meta-anual", ano] }),
      ]);
      onOpenChange(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar a configuração das metas.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto bg-[var(--surface-raised)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: "var(--voux-text-heading)" }}>
            <Target className="h-5 w-5 text-[var(--voux-accent)]" />
            Configuração de metas · {ano}
          </DialogTitle>
          <DialogDescription>
            Defina a meta anual da empresa, distribua a curva por mês e lance a meta anual de cada consultor na mesma tela.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando configuração…
          </div>
        ) : (
          <div className="space-y-5">
            <section className="rounded-xl border p-4" style={{ borderColor: "var(--voux-card-border)" }}>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">1. Meta geral da empresa</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Esse valor é a referência anual para toda a distribuição.</p>
                </div>
                <div className="w-full sm:w-64">
                  <Label htmlFor="meta-anual-empresa">Meta anual (R$)</Label>
                  <Input
                    id="meta-anual-empresa"
                    className="mt-1.5 text-right font-mono text-base font-semibold"
                    type="text"
                    inputMode="decimal"
                    value={metaAnual}
                    onChange={(event) => setMetaAnual(formatLiveNumber(event.target.value))}
                    onBlur={() => setMetaAnual(formatInputNumber(metaAnual))}
                    placeholder="33000000"
                  />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <SummaryCard label="Meta anual" value={money(metaAnualValue)} />
                <SummaryCard label="Total lançado" value={money(totalDistribuido)} />
                <SummaryCard
                  label={saldo >= 0 ? "Falta lançar" : "Lançado acima"}
                  value={money(Math.abs(saldo))}
                  tone={saldo === 0 ? "success" : saldo < 0 ? "warning" : "default"}
                />
              </div>
            </section>

            <section className="rounded-xl border p-4" style={{ borderColor: "var(--voux-card-border)" }}>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">2. Curva mensal da empresa</h3>
                  <p className="mt-1 text-xs text-muted-foreground">A soma precisa ser 100%. Ela será aplicada automaticamente a todos os consultores.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={usarCurvaPadrao} className="gap-1.5">
                  <WandSparkles className="h-3.5 w-3.5" /> Usar curva padrão
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {MONTHS.map((month, index) => (
                  <div key={month} className="space-y-1.5">
                    <Label htmlFor={`percentual-${index}`} className="text-xs">{month}</Label>
                    <div className="relative">
                      <Input
                        id={`percentual-${index}`}
                        type="text"
                        inputMode="decimal"
                        value={percentuais[index] ?? ""}
                        onChange={(event) => atualizarPercentual(index, formatLiveNumber(event.target.value))}
                        onBlur={() => atualizarPercentual(index, formatInputNumber(percentuais[index] ?? ""))}
                        className="pr-7 text-right font-mono"
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground">%</span>
                    </div>
                    <p className="text-right text-[10px] text-muted-foreground">{money(metasMensaisEmpresa[index] ?? 0)}</p>
                  </div>
                ))}
              </div>
              <div className={cn("mt-3 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs", curvaValida ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300" : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300")}>
                <span className="flex items-center gap-1.5">
                  {curvaValida ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                  {curvaValida
                    ? "Curva mensal fechada em 100%."
                    : percentualTotal < 100
                      ? `Faltam ${percentage(100 - percentualTotal)} — aumente qualquer mês nesse total.`
                      : `Excede ${percentage(percentualTotal - 100)} — reduza qualquer mês nesse total.`}
                </span>
                <strong className="shrink-0 font-mono">{percentage(percentualTotal)} / 100%</strong>
              </div>
            </section>

            <section className="rounded-xl border p-4" style={{ borderColor: "var(--voux-card-border)" }}>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">3. Metas anuais por consultor</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Informe os valores anuais. Os meses serão calculados pela curva acima.</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  Distribuído: <strong className="font-mono text-foreground">{percentage(percentualDistribuido)}</strong> da meta
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--voux-card-border)" }}>
                <div className="grid grid-cols-[1fr_180px_130px] gap-3 bg-black/[0.03] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:bg-white/[0.04]">
                  <span>Consultor</span><span className="text-right">Meta anual</span><span className="text-right">Participação</span>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {consultores.length === 0 ? (
                    <p className="px-3 py-5 text-center text-sm text-muted-foreground">Nenhum consultor disponível para lançamento.</p>
                  ) : consultores.map((consultor) => {
                    const value = toNumber(metasConsultores[consultor] ?? "");
                    const share = metaAnualValue > 0 ? (value / metaAnualValue) * 100 : 0;
                    return (
                      <div key={consultor} className="grid grid-cols-[1fr_180px_130px] items-center gap-3 border-t px-3 py-2" style={{ borderColor: "var(--voux-card-border)" }}>
                        <span className="truncate text-sm">{consultor}</span>
                        <Input
                          aria-label={`Meta anual de ${consultor}`}
                          type="text"
                          inputMode="decimal"
                          value={metasConsultores[consultor] ?? ""}
                          onChange={(event) => atualizarMetaConsultor(consultor, formatLiveNumber(event.target.value))}
                          onBlur={() => atualizarMetaConsultor(consultor, formatInputNumber(metasConsultores[consultor] ?? ""))}
                          placeholder="0,00"
                          className="text-right font-mono"
                        />
                        <span className="text-right text-xs font-mono text-muted-foreground">{percentage(share)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                O sistema permite salvar abaixo ou acima da meta e mostra o saldo para facilitar o ajuste. A soma dos consultores não precisa ser alterada automaticamente.
              </p>
            </section>
          </div>
        )}

        {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={salvar} disabled={!podeSalvar} className="gap-1.5">
            <Save className="h-4 w-4" />
            {saving ? "Salvando…" : "Salvar configuração"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "warning" }) {
  return (
    <div className={cn("rounded-lg border px-3 py-2", tone === "success" && "border-emerald-500/20 bg-emerald-500/5", tone === "warning" && "border-amber-500/20 bg-amber-500/5")}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-mono text-sm font-semibold">{value}</p>
    </div>
  );
}
