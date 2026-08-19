import { Minus, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
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

export function AcoesSinaisSemanaIA({ data, loading, error }: Props) {
  const score = data?.score ?? 0;
  const tone = score > 10 ? "text-emerald-600" : score < -10 ? "text-[var(--voux-danger)]" : "text-[var(--voux-text-muted)]";
  const ScoreIcon = score > 10 ? TrendingUp : score < -10 ? TrendingDown : Minus;

  return (
    <BiTableCard
      title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[var(--voux-accent)]" aria-hidden="true" />Sinais da semana</span>}
      description="Leitura de descrições concluídas de ações e negócios; não substitui os KPIs operacionais."
      loading={loading}
      error={error}
      isEmpty={!loading && !error && !(data?.totalTextos)}
      emptyMessage="A análise semanal será exibida após o primeiro processamento concluído."
      skeletonRows={3}
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-lg border border-[var(--voux-card-border)] p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--voux-text-muted)]">Sentimento comercial</p>
              <p className={`mt-1 flex items-center gap-1 text-2xl font-semibold tabular-nums ${tone}`}><ScoreIcon className="h-5 w-5" />{score > 0 ? "+" : ""}{score.toFixed(0)}</p>
              <p className="mt-1 text-[11px] text-[var(--voux-text-muted)]">{formatWeek(data?.semanaInicio)} a {formatWeek(data?.semanaFim)} · {data?.totalTextos ?? 0} textos lidos</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <span><strong className="block text-emerald-600">{data?.positivos ?? 0}</strong>positivos</span>
              <span><strong className="block text-[var(--voux-danger)]">{data?.negativos ?? 0}</strong>negativos</span>
              <span><strong className="block text-[var(--voux-text-muted)]">{data?.neutros ?? 0}</strong>neutros</span>
            </div>
          </div>
          {data?.topTermos?.length ? <p className="mt-3 text-xs text-[var(--voux-text-muted)]">Termos recorrentes: {data.topTermos.slice(0, 4).map((term) => term.termo).join(" · ")}</p> : null}
        </div>
        <div className="rounded-lg border border-[var(--voux-card-border)] p-3">
          <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--voux-text-muted)]">Produtos de maior interesse</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data?.produtos?.map((item) => (
              <span key={item.produto} className="rounded-full bg-[var(--voux-accent)]/10 px-2.5 py-1 text-xs text-[var(--voux-text-primary)]">
                {item.produto} <strong className="ml-1 text-[var(--voux-accent)]">{item.mencoes}</strong>
              </span>
            ))}
          </div>
        </div>
      </div>
    </BiTableCard>
  );
}
