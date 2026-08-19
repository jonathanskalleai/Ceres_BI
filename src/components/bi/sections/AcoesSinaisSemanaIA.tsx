import { ArrowUpRight, Lightbulb, Sparkles } from "lucide-react";
import { BiTableCard } from "@/components/bi/BiTableCard";
import type { AiSinaisCampoSemanais } from "@/services/aiService";

interface Props {
  data?: AiSinaisCampoSemanais;
  loading?: boolean;
  error?: Error | null;
}

const formatWeek = (value?: string) => value
  ? new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
  : "—";

function getInsight(data?: AiSinaisCampoSemanais) {
  if (!data?.totalTextos) return null;

  const positive = data.positivos ?? 0;
  const negative = data.negativos ?? 0;
  const neutral = data.neutros ?? 0;
  const total = data.totalTextos;
  const mainProducts = (data.produtos ?? []).slice(0, 2).map((item) => item.produto);
  const productText = mainProducts.length
    ? ` Os produtos mais citados foram ${new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" }).format(mainProducts)}.`
    : "";

  if (negative > positive && negative >= neutral) {
    return `A leitura da IA identificou um tom de atenção nas descrições da semana: ${negative} de ${total} registros trazem sinais negativos. Vale priorizar os casos com objeções antes que esfriem.${productText}`;
  }
  if (positive > negative && positive >= neutral) {
    return `A leitura da IA é favorável: ${positive} de ${total} descrições trazem intenção ou avanço comercial, sem perder de vista os ${neutral} contatos ainda em acompanhamento.${productText}`;
  }
  return `A leitura da IA está equilibrada: há ${positive} sinais positivos, ${neutral} contatos em acompanhamento e ${negative} alertas nas ${total} descrições analisadas.${productText}`;
}

function getRecommendation(data?: AiSinaisCampoSemanais) {
  if (!data?.totalTextos) return null;
  if (data.negativos > data.positivos) {
    return "Prioridade da semana: revisar as objeções apontadas e definir uma tratativa para cada cliente em risco.";
  }
  if (data.positivos > 0) {
    return "Prioridade da semana: transformar os contatos com intenção em próximo passo registrado — proposta, visita ou retorno agendado.";
  }
  return "Prioridade da semana: usar os temas recorrentes para orientar a próxima abordagem comercial.";
}

export function AcoesSinaisSemanaIA({ data, loading, error }: Props) {
  const insight = getInsight(data);
  const recommendation = getRecommendation(data);
  const terms = data?.topTermos?.slice(0, 7) ?? [];
  const maxMentions = Math.max(...terms.map((term) => term.mencoes), 1);

  return (
    <BiTableCard
      title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[var(--voux-accent)]" aria-hidden="true" />Sinais da semana</span>}
      description="A IA transforma as descrições de ações e negócios em uma leitura comercial da semana."
      loading={loading}
      error={error}
      isEmpty={!loading && !error && !(data?.totalTextos)}
      emptyMessage="A análise semanal será exibida após o primeiro processamento concluído."
      skeletonRows={3}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <div className="rounded-lg border border-[var(--voux-accent)]/20 bg-[var(--voux-accent)]/[0.04] p-4">
          <div className="flex items-start gap-2">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--voux-accent)]" aria-hidden="true" />
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--voux-text-muted)]">Insight da IA</p>
              <p className="mt-2 text-sm leading-6 text-[var(--voux-text-primary)]">{insight}</p>
              <p className="mt-3 text-[11px] text-[var(--voux-text-muted)]">
                Período analisado: {formatWeek(data?.semanaInicio)} a {formatWeek(data?.semanaFim)} · base de {data?.totalTextos ?? 0} descrições
              </p>
            </div>
          </div>
          {recommendation ? (
            <div className="mt-4 flex gap-2 border-t border-[var(--voux-card-border)] pt-3 text-xs leading-5 text-[var(--voux-text-primary)]">
              <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--voux-accent)]" aria-hidden="true" />
              <p>{recommendation}</p>
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-[var(--voux-card-border)] p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--voux-text-muted)]">Temas identificados</p>
          <p className="mt-1 text-xs text-[var(--voux-text-muted)]">Expressões recorrentes nas descrições analisadas</p>
          <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Temas recorrentes identificados pela IA">
            {terms.map((term) => {
              const prominence = term.mencoes / maxMentions;
              const size = prominence >= 0.8 ? "text-sm font-semibold" : prominence >= 0.45 ? "text-[13px] font-medium" : "text-xs";
              return (
                <span
                  key={term.termo}
                  className={`rounded-full border border-[var(--voux-accent)]/20 bg-[var(--voux-accent)]/[0.06] px-2.5 py-1.5 text-[var(--voux-text-primary)] ${size}`}
                  title={`${term.mencoes} ${term.mencoes === 1 ? "menção" : "menções"}`}
                >
                  {term.termo}
                </span>
              );
            })}
          </div>
          {data?.produtos?.length ? (
            <p className="mt-4 border-t border-[var(--voux-card-border)] pt-3 text-xs leading-5 text-[var(--voux-text-muted)]">
              <span className="font-medium text-[var(--voux-text-primary)]">Produtos em evidência: </span>
              {data.produtos.slice(0, 3).map((item) => `${item.produto} (${item.mencoes})`).join(" · ")}
            </p>
          ) : null}
        </div>
      </div>
    </BiTableCard>
  );
}
