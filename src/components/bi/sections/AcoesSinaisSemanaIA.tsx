import { ArrowUpRight, Lightbulb, ShieldAlert, Sparkles } from "lucide-react";
import { BiTableCard } from "@/components/bi/BiTableCard";
import type { AiSinaisCampoSemanais } from "@/services/aiService";

interface Props {
  data?: AiSinaisCampoSemanais;
  loading?: boolean;
  error?: Error | null;
}

type FieldNarrative = NonNullable<AiSinaisCampoSemanais["analiseIa"]>;

const formatWeek = (value?: string) => value
  ? new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
  : "—";

function fallbackNarrative(data?: AiSinaisCampoSemanais): FieldNarrative | null {
  if (!data?.totalTextos) return null;

  const products = data.produtos.slice(0, 3).map((item) => item.produto);
  const productText = products.length ? ` Os produtos com mais menções foram ${new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" }).format(products)}.` : "";
  const sentiment = data.negativos > data.positivos
    ? `Os ${data.negativos} sinais negativos superam os ${data.positivos} positivos, indicando que as objeções e os retornos pendentes merecem priorização.`
    : `Foram identificados ${data.positivos} sinais positivos, ${data.neutros} neutros e ${data.negativos} negativos. A leitura indica intenção comercial, mas ainda há contatos que precisam de próximo passo claro.`;

  return {
    titulo: "Leitura de sentimento e demanda",
    resumoExecutivo: `A base desta semana reúne ${data.totalTextos} descrições de ações e negócios. Os temas recorrentes ajudam a mostrar o que os clientes estão verbalizando — além dos indicadores operacionais.${productText}`,
    leituraSentimento: sentiment,
    interessesDemanda: products.length ? [{ tema: "Produtos em evidência", leitura: productText.trim() }] : [],
    objecoesAlertas: [],
    proximosPassos: [data.negativos > data.positivos
      ? "Revisar os registros com objeção e definir uma tratativa específica para cada contato."
      : "Converter as intenções identificadas em proposta, visita ou retorno agendado no CRM."],
    confianca: data.totalTextos < 10 ? "baixa" : data.totalTextos < 30 ? "media" : "alta",
    baseRegistros: data.totalTextos,
    coberturaPercentual: 100,
  };
}

export function AcoesSinaisSemanaIA({ data, loading, error }: Props) {
  const analysis = data?.analiseIa ?? fallbackNarrative(data);
  const terms = data?.topTermos ?? [];
  const focusTopics = analysis?.interessesDemanda?.map((item) => item.tema).filter(Boolean) ?? [];
  const primaryAlert = analysis?.objecoesAlertas?.[0];
  const maxMentions = Math.max(...terms.map((term) => term.mencoes), 1);
  const confidenceLabel = analysis?.confianca === "alta" ? "Base consistente" : analysis?.confianca === "media" ? "Leitura em evolução" : "Sinal preliminar";
  const coverageLabel = analysis?.baseRegistros && analysis.baseRegistros > (data?.totalTextos ?? 0)
    ? `${data?.totalTextos ?? 0} de ${analysis.baseRegistros} descrições`
    : `${data?.totalTextos ?? 0} descrições analisadas`;

  return (
    <BiTableCard
      title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[var(--voux-accent)]" aria-hidden="true" />Sinais da semana</span>}
      description="Leitura de sentimento, demanda e objeções extraída das descrições de ações e negócios."
      loading={loading}
      error={error}
      isEmpty={!loading && !error && !(data?.totalTextos)}
      emptyMessage="A análise semanal será exibida após o primeiro processamento concluído."
      skeletonRows={5}
    >
      <div className="rounded-lg border border-[var(--voux-accent)]/20 bg-[var(--voux-accent)]/[0.04] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--voux-accent)]" aria-hidden="true" />
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--voux-text-muted)]">Insight da IA</p>
              <h3 className="mt-1 text-base font-semibold text-[var(--voux-text-heading)]">{analysis?.titulo}</h3>
            </div>
          </div>
          <span className="rounded-full border border-[var(--voux-card-border)] bg-[var(--voux-card-bg)] px-2.5 py-1 text-[11px] text-[var(--voux-text-muted)]" title={coverageLabel}>{confidenceLabel} · {Math.round(analysis?.coberturaPercentual ?? 0)}%</span>
        </div>
        <p className="mt-4 text-sm leading-6 text-[var(--voux-text-primary)]">{analysis?.resumoExecutivo}</p>
        {focusTopics.length ? <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--voux-card-border)] pt-3">
          <span className="mr-1 text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--voux-text-muted)]">Focos comerciais</span>
          {focusTopics.map((topic) => <span key={topic} className="rounded-full border border-[var(--voux-accent)]/25 bg-[var(--voux-accent)]/[0.07] px-2.5 py-1 text-xs font-medium text-[var(--voux-text-primary)]">{topic}</span>)}
        </div> : null}
        {primaryAlert ? <div className="mt-3 flex gap-2 rounded-md border border-[var(--voux-danger)]/20 bg-[var(--voux-danger)]/[0.04] px-3 py-2.5">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--voux-danger)]" aria-hidden="true" />
          <p className="text-xs leading-5 text-[var(--voux-text-muted)]"><span className="font-medium text-[var(--voux-text-primary)]">Alerta: {primaryAlert.tema}. </span>{primaryAlert.leitura}</p>
        </div> : null}
        <p className="mt-4 text-[11px] text-[var(--voux-text-muted)]">Período analisado: {formatWeek(data?.semanaInicio)} a {formatWeek(data?.semanaFim)} · base de {coverageLabel}</p>
      </div>

      <div className="mt-4 rounded-lg border border-[var(--voux-card-border)] bg-[var(--voux-card-bg)] p-4">
        <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--voux-text-muted)]"><ArrowUpRight className="h-4 w-4 text-[var(--voux-accent)]" aria-hidden="true" /> Próximos passos sugeridos</p>
        <ol className="mt-3 grid gap-2 md:grid-cols-3">
          {(analysis?.proximosPassos ?? []).map((item, index) => <li key={item} className="flex min-w-0 gap-3 rounded-md border border-[var(--voux-card-border)] bg-[var(--surface-raised)] p-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--voux-accent)]/10 text-[11px] font-semibold text-[var(--voux-accent)]">{String(index + 1).padStart(2, "0")}</span>
            <span className="text-xs leading-5 text-[var(--voux-text-primary)]">{item}</span>
          </li>)}
        </ol>
      </div>

      <details className="group mt-4 rounded-lg border border-[var(--voux-card-border)] p-4">
        <summary className="cursor-pointer list-none text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--voux-text-muted)]">
          <span className="flex items-center justify-between gap-3">Temas e produtos identificados <span className="text-[10px] normal-case tracking-normal text-[var(--voux-text-faint)]">{terms.length} temas · {data?.produtos?.length ?? 0} produtos</span></span>
        </summary>
        <p className="mt-2 text-xs text-[var(--voux-text-muted)]">Expressões e produtos recorrentes nas descrições analisadas.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Temas recorrentes identificados pela IA">
          {terms.map((term) => {
            const prominence = term.mencoes / maxMentions;
            const size = prominence >= 0.8 ? "text-sm font-semibold" : prominence >= 0.45 ? "text-[13px] font-medium" : "text-xs";
            return <span key={term.termo} className={`rounded-full border border-[var(--voux-accent)]/20 bg-[var(--voux-accent)]/[0.06] px-2.5 py-1.5 text-[var(--voux-text-primary)] ${size}`} title={`${term.mencoes} ${term.mencoes === 1 ? "menção" : "menções"}`}>{term.termo}</span>;
          })}
        </div>
        {data?.produtos?.length ? <p className="mt-4 border-t border-[var(--voux-card-border)] pt-3 text-xs leading-5 text-[var(--voux-text-muted)]"><span className="font-medium text-[var(--voux-text-primary)]">Produtos em evidência: </span>{data.produtos.map((item) => `${item.produto} (${item.mencoes})`).join(" · ")}</p> : null}
      </details>

    </BiTableCard>
  );
}
