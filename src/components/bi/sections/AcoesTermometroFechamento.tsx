import { useMemo, useState } from "react";
import { BriefcaseBusiness, Target } from "lucide-react";
import { BiTableCard } from "@/components/bi/BiTableCard";
import { ChipToggle, type ChipOption } from "@/components/bi/ChipToggle";
import { useAcoesTermometroFechamentoRpc } from "@/hooks/bi/useAcoesTermometroFechamentoRpc";
import { fmtBRL, fmtBRLKpi, fmtNum } from "@/lib/formatters";
import type { AcoesTermometroEscopo, AcoesTermometroFaixa } from "@/types/biRpc";

const ESCOPO_OPTIONS: readonly ChipOption<AcoesTermometroEscopo>[] = [
  { value: "ativos_periodo", label: "Carteira ativa" },
  { value: "carteira_total", label: "Carteira total" },
];

function corFaixa(estrelas: number): string {
  if (estrelas >= 4) return "var(--voux-success)";
  if (estrelas === 3) return "var(--voux-warning)";
  if (estrelas > 0) return "var(--voux-danger)";
  return "var(--voux-text-faint)";
}

function estrelasLabel(estrelas: number): string {
  return `${"★".repeat(estrelas)}${"☆".repeat(5 - estrelas)}`;
}

interface Props {
  from?: string;
  to?: string;
  vendedor?: string;
  cidade?: string;
  active?: boolean;
}

/**
 * Fila prática de fechamento: probabilidade do CRM e valor mostram ao gestor
 * onde agir primeiro. Não é outro funil: etapa e probabilidade são dimensões
 * diferentes e exibí-las como um único funil induziria uma leitura errada. A
 * lista traz até 50 prioridades e rola dentro da altura da coluna ao lado.
 */
export function AcoesTermometroFechamento({ from, to, vendedor, cidade, active = true }: Props) {
  const [escopo, setEscopo] = useState<AcoesTermometroEscopo>("ativos_periodo");
  const { data, isLoading, error } = useAcoesTermometroFechamentoRpc({
    from,
    to,
    vendedor,
    cidade,
    escopo,
    enabled: active && (escopo === "carteira_total" || (!!from && !!to)),
  });

  const resumo = data?.resumo;
  const faixas = data?.faixas ?? [];
  const prioridades = data?.prioridades ?? [];
  const faixasComNegocios = useMemo(
    () => faixas.filter((faixa) => faixa.negocios > 0),
    [faixas],
  );
  const maxValorFaixa = useMemo(
    () => Math.max(...faixas.map((faixa) => faixa.valor), 1),
    [faixas],
  );
  const descricaoEscopo = escopo === "ativos_periodo"
    ? "Carteira ativa: negócios em andamento que receberam ao menos uma ação no período"
    : "Carteira total: todos os negócios que continuam abertos hoje, independente do período";
  const unidadeNegocios = escopo === "ativos_periodo"
    ? "negócios ativos no período"
    : "negócios abertos na carteira total";
  const quantidadeExibida = prioridades.length;

  return (
    <BiTableCard
      title="Termômetro de Fechamento"
      loading={isLoading && !data}
      error={error}
      isEmpty={!isLoading && !!resumo && resumo.negocios === 0}
      emptyMessage={escopo === "ativos_periodo" ? "Nenhum negócio aberto com ação no período" : "Nenhum negócio aberto na carteira"}
      skeletonRows={8}
      className="flex h-full min-h-0 flex-col"
      actions={
        <ChipToggle
          options={ESCOPO_OPTIONS}
          value={escopo}
          onChange={setEscopo}
          ariaLabel="Escolher a carteira do termômetro de fechamento"
        />
      }
      footer={
        <p className="mt-3 text-[11px] leading-relaxed text-[var(--voux-text-muted)]">
          A previsão ponderada usa os mesmos negócios da base exibida acima. Lista: {fmtNum(quantidadeExibida)} de {fmtNum(resumo?.negocios ?? 0)} prioridades.
        </p>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <p className="mb-3 text-[11px] text-[var(--voux-text-muted)]">{descricaoEscopo}</p>

        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Resumo
            label="Base do termômetro"
            value={fmtNum(resumo?.negocios ?? 0)}
            unit={unidadeNegocios}
            hint={`${fmtNum(resumo?.clientes ?? 0)} clientes · ${fmtBRLKpi(resumo?.valorBruto ?? 0)}`}
            icon={BriefcaseBusiness}
            accent="var(--voux-champagne-400)"
          />
          <Resumo
            label="Previsão ponderada"
            value={fmtBRLKpi(resumo?.valorPonderado ?? 0)}
            hint={`${fmtNum(resumo?.negociosQuentes ?? 0)} oportunidades em 4–5 estrelas`}
            icon={Target}
            accent="var(--voux-success)"
          />
        </div>

        <div className="mb-4" aria-label="Distribuição de probabilidade de fechamento">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase text-[var(--voux-text-muted)]" style={MONO_STYLE}>Temperatura da carteira</p>
            <p className="text-[10px] text-[var(--voux-text-faint)]" style={MONO_STYLE}>negócios · valor</p>
          </div>
          <div className="space-y-1">
            {faixasComNegocios.map((faixa) => (
              <FaixaProbabilidade key={faixa.estrelas} faixa={faixa} maxValor={maxValorFaixa} />
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col border-t border-[var(--voux-card-border)] pt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase text-[var(--voux-text-muted)]" style={MONO_STYLE}>Prioridades de fechamento</p>
            <p className="text-[10px] text-[var(--voux-text-faint)]" style={MONO_STYLE}>mostrando {quantidadeExibida} de {fmtNum(resumo?.negocios ?? 0)}</p>
          </div>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1" role="list" aria-label="Oportunidades com maior probabilidade de fechamento">
            {prioridades.map((prioridade) => (
              <div
                key={prioridade.negocio}
                role="listitem"
                className="grid grid-cols-[62px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-[var(--voux-card-border)] bg-[var(--surface-raised)] px-3 py-2.5"
              >
                <span
                  className="text-[12px] leading-none"
                  style={{ color: corFaixa(prioridade.estrelas) }}
                  aria-label={`${prioridade.estrelas} de 5 estrelas`}
                  title={`${prioridade.estrelas} de 5 estrelas`}
                >
                  {estrelasLabel(prioridade.estrelas)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-[var(--voux-text-primary)]" title={prioridade.cliente}>{prioridade.cliente}</p>
                  <p className="truncate text-[11px] text-[var(--voux-text-muted)]" title={prioridade.produto}>
                    {prioridade.produto}{prioridade.etapa ? ` · ${prioridade.etapa}` : ""}
                  </p>
                </div>
                <span className="text-right text-[12px] font-medium tabular-nums text-[var(--voux-text-primary)]">{fmtBRL(prioridade.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BiTableCard>
  );
}

function Resumo({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  icon: typeof Target;
  accent: string;
}) {
  return (
    <div
      className="rounded-xl px-3.5 py-3"
      style={{
        background: `color-mix(in srgb, ${accent} 13%, var(--surface-raised))`,
        border: `1px solid color-mix(in srgb, ${accent} 34%, var(--voux-card-border))`,
      }}
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase text-[var(--voux-text-primary)]" style={MONO_STYLE}>
        <Icon className="h-3.5 w-3.5" style={{ color: accent }} aria-hidden="true" />
        {label}
      </div>
      <div>
        <p className="text-[22px] font-semibold leading-none tabular-nums text-[var(--voux-text-primary)]">{value}</p>
        {unit && <p className="mt-1 text-[11px] text-[var(--voux-text-muted)]">{unit}</p>}
      </div>
      {hint && <p className="mt-1.5 text-[11px] text-[var(--voux-text-primary)] opacity-75">{hint}</p>}
    </div>
  );
}

function FaixaProbabilidade({ faixa, maxValor }: { faixa: AcoesTermometroFaixa; maxValor: number }) {
  const percentual = maxValor > 0 ? (faixa.valor / maxValor) * 100 : 0;
  const cor = corFaixa(faixa.estrelas);

  return (
    <div
      className="flex items-center gap-2 rounded-lg px-2 py-1.5"
      style={{ background: `color-mix(in srgb, ${cor} 7%, var(--surface-raised))` }}
    >
      <span className="w-9 shrink-0 text-[11px] font-medium" style={{ color: cor, fontFamily: "var(--voux-font-mono)" }}>
        {faixa.estrelas} ★
      </span>
      <div className="h-2.5 w-14 shrink-0 overflow-hidden rounded-full bg-[var(--voux-card-border)]" role="meter" aria-valuenow={faixa.valor} aria-valuemin={0} aria-valuemax={maxValor}>
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${percentual}%`, background: cor }} />
      </div>
      <div className="ml-auto flex min-w-0 items-baseline justify-end gap-2.5 tabular-nums text-[var(--voux-text-primary)]">
        <span className="whitespace-nowrap">
          <strong className="text-[16px] leading-none">{fmtNum(faixa.negocios)}</strong>{" "}
          <span className="text-[10px] text-[var(--voux-text-muted)]">negócios</span>
        </span>
        <span className="whitespace-nowrap text-[13px] font-semibold" title={fmtBRL(faixa.valor)}>{fmtBRLKpi(faixa.valor)}</span>
      </div>
    </div>
  );
}

const MONO_STYLE: React.CSSProperties = {
  fontFamily: "var(--voux-font-mono)",
  letterSpacing: "0.1em",
};
