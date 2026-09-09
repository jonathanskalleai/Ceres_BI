import { lazy, Suspense, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BiGestaoErro } from "@/components/bi/BiGestaoErro";
import { OPORTUNIDADE_ABERTA_PIN_COLOR } from "@/components/dashboard/mapa/constants";
import { useAcoesMapaRpc } from "@/hooks/bi/useAcoesMapaRpc";
import { fmtNum } from "@/lib/formatters";
import type { OportunidadePoint } from "@/components/dashboard/mapa/types";
import type { AcoesMapaPino } from "@/types/biRpc";

const LazyAcoesMapaCanvas = lazy(() => import("./AcoesMapaCanvas"));

const CARD =
  "rounded-2xl border border-[var(--voux-card-border)] bg-[var(--surface-raised)] shadow-[var(--voux-card-shadow)]";

/** Transforma o payload da RPC no ponto do mapa (`lon` -> `lng` do Leaflet). */
function toPoints(pinos: AcoesMapaPino[]): OportunidadePoint[] {
  return pinos.map((p) => ({
    negocio: p.negocio,
    cliente: p.cliente,
    cidade: p.cidade,
    etapa: p.etapa,
    valor: p.valor,
    consultor: p.consultor,
    situacao: p.situacao,
    acoesNoPeriodo: p.acoesNoPeriodo,
    ultimaAcaoPeriodo: p.ultimaAcaoPeriodo,
    lat: p.lat,
    lng: p.lon,
    diasParado: p.diasParado,
  }));
}

/** Agrupa pinos por coordenada arredondada em 4 decimais (~11m de resolucao). */
function clusterByCoord(points: OportunidadePoint[]): Map<string, OportunidadePoint[]> {
  const map = new Map<string, OportunidadePoint[]>();
  for (const p of points) {
    const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
    const arr = map.get(key);
    if (arr) arr.push(p);
    else map.set(key, [p]);
  }
  return map;
}

interface Props {
  vendedor?: string;
  cidade?: string;
  from?: string;
  to?: string;
  active?: boolean;
}

/**
 * Mapa da mesma coorte de oportunidades do funil: primeira entrada no funil
 * VENDAS no período selecionado. "Oportunidade" no CRM é uma etapa específica
 * e não deve rotular todo negócio do mapa.
 *
 * O mapa não carrega o estoque inteiro: traz somente a coorte do período e
 * mostra os desfechos pelos mesmos critérios dos cards (pedido/fechamento).
 * Pinos no mesmo local (~11m) são agrupados com badge numérico.
 */
export function AcoesMapaOportunidades({ vendedor, cidade, from, to, active = true }: Props) {
  const [aberto, setAberto] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const shouldLoad = active && aberto;
  const { data, isLoading, error } = useAcoesMapaRpc({
    vendedor,
    cidade,
    from,
    to,
    enabled: shouldLoad,
  });

  const points = useMemo(() => toPoints(data?.pinos ?? []), [data]);
  const clusters = useMemo(() => clusterByCoord(points), [points]);

  // Separa pinos isolados (grupo.length === 1) dos clusters reais (> 1)
  const { singlePoints, clusterGroups } = useMemo(() => {
    const singles: OportunidadePoint[] = [];
    const groups: { key: string; lat: number; lng: number; points: OportunidadePoint[] }[] = [];
    for (const [key, pts] of clusters) {
      if (pts.length === 1) {
        singles.push(pts[0]);
      } else {
        const [latStr, lngStr] = key.split(",");
        groups.push({ key, lat: Number(latStr), lng: Number(lngStr), points: pts });
      }
    }
    return { singlePoints: singles, clusterGroups: groups };
  }, [clusters]);

  const locaisNoMapa = singlePoints.length + clusterGroups.length;
  const oportunidadesAgrupadas = Math.max(0, (data?.comCoordenada ?? 0) - locaisNoMapa);

  return (
    <section className={CARD} aria-label="Mapa de oportunidades do período">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-controls="mapa-oportunidades-painel"
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-foreground/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--voux-champagne-400)]"
      >
        {aberto ? (
          <ChevronDown className="h-4 w-4 text-[var(--voux-text-muted)]" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[var(--voux-text-muted)]" aria-hidden="true" />
        )}
        <MapPin className="h-4 w-4" style={{ color: OPORTUNIDADE_ABERTA_PIN_COLOR }} aria-hidden="true" />
        <span
          className="text-[15px] font-medium tracking-[-0.01em] text-[var(--voux-text-heading)]"
          style={{ fontFamily: "var(--voux-font-sans)" }}
        >
          Mapa de Oportunidades do Período
        </span>
      </button>

      {aberto && (
        <div id="mapa-oportunidades-painel" className="px-5 pb-5">
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--voux-text-muted)]">
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: OPORTUNIDADE_ABERTA_PIN_COLOR }} />Em andamento: {fmtNum(data?.meta.abertos ?? 0)}</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[var(--voux-success)]" />Ganhos (pedidos): {fmtNum(data?.meta.ganhos ?? 0)}</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[var(--voux-danger)]" />Perdidos: {fmtNum(data?.meta.perdidos ?? 0)}</span>
          </div>

          {!shouldLoad && (
            <Skeleton className="w-full rounded-[20px]" style={{ height: 520, background: "var(--voux-skeleton)" }} />
          )}

          {shouldLoad && isLoading && (
            <Skeleton className="w-full rounded-[20px]" style={{ height: 520, background: "var(--voux-skeleton)" }} />
          )}

          {shouldLoad && !isLoading && error && <BiGestaoErro error={error} contexto="os pinos do mapa" />}

          {shouldLoad && !isLoading && !error && (
            <>
              <Suspense fallback={<Skeleton className="w-full rounded-[20px]" style={{ height: 520, background: "var(--voux-skeleton)" }} />}>
                <LazyAcoesMapaCanvas
                  singlePoints={singlePoints}
                  clusterGroups={clusterGroups}
                  comCoordenada={data?.comCoordenada ?? 0}
                  total={data?.total ?? 0}
                  valorNoMapa={data?.valorNoMapa ?? 0}
                  valorTotal={data?.valorTotal ?? 0}
                  semCoordenada={data?.semCoordenada ?? 0}
                  viaAcao={data?.meta.viaAcao ?? 0}
                  viaCarteira={data?.meta.viaCarteira ?? 0}
                  locaisNoMapa={locaisNoMapa}
                  oportunidadesAgrupadas={oportunidadesAgrupadas}
                  fullscreen={fullscreen}
                  onToggleFullscreen={() => setFullscreen((v) => !v)}
                />
              </Suspense>
            </>
          )}
        </div>
      )}
    </section>
  );
}
