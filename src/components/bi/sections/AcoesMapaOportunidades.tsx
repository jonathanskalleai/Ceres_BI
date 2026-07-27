import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BiGestaoErro } from "@/components/bi/BiGestaoErro";
import { ChipToggle, type ChipOption } from "@/components/bi/ChipToggle";
import { MapView } from "@/components/dashboard/mapa";
import { ClusterMarker } from "@/components/dashboard/mapa/ClusterMarker";
import type { OportunidadePoint } from "@/components/dashboard/mapa";
import { useAcoesMapaRpc } from "@/hooks/bi/useAcoesMapaRpc";
import { fmtBRL, fmtNum } from "@/lib/formatters";
import type { AcoesMapaPino } from "@/types/biRpc";

type FiltroMapa = "estoque" | "periodo";

const FILTRO_OPTIONS: readonly ChipOption<FiltroMapa>[] = [
  { value: "estoque", label: "Todas abertas" },
  { value: "periodo", label: "Tocadas no mes" },
];

const CARD =
  "rounded-2xl border border-[var(--voux-card-border)] bg-[var(--surface-raised)] shadow-[var(--voux-card-shadow)]";

/** Centro padrao do mapa — mesma regiao de atuacao do restante do dashboard. */
const CENTRO: [number, number] = [-27.1, -52.6];

/** Transforma o payload da RPC no ponto do mapa (`lon` -> `lng` do Leaflet). */
function toPoints(pinos: AcoesMapaPino[]): OportunidadePoint[] {
  return pinos.map((p) => ({
    negocio: p.negocio,
    cliente: p.cliente,
    cidade: p.cidade,
    etapa: p.etapa,
    valor: p.valor,
    consultor: p.consultor,
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
 * Mapa das oportunidades abertas (pedido 6), COLAPSADO por padrao.
 *
 * O Leaflet so monta — e a RPC so roda — quando o bloco abre. Toggle interno
 * alterna entre estoque (todas abertas) e periodo (tocadas no mes). Pinos no
 * mesmo local (~11m) sao agrupados em cluster com badge numerico.
 */
export function AcoesMapaOportunidades({ vendedor, cidade, from, to, active = true }: Props) {
  const [aberto, setAberto] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [filtro, setFiltro] = useState<FiltroMapa>("estoque");

  const rpcFrom = filtro === "periodo" ? from : undefined;
  const rpcTo = filtro === "periodo" ? to : undefined;

  const { data, isLoading, error } = useAcoesMapaRpc({
    vendedor,
    cidade,
    from: rpcFrom,
    to: rpcTo,
    enabled: active && aberto,
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

  return (
    <section className={CARD} aria-label="Mapa de oportunidades abertas">
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
        <MapPin className="h-4 w-4 text-[var(--voux-champagne-400)]" aria-hidden="true" />
        <span className="flex flex-col">
          <span
            className="text-[15px] font-medium tracking-[-0.01em] text-[var(--voux-text-heading)]"
            style={{ fontFamily: "var(--voux-font-sans)" }}
          >
            Mapa de Oportunidades Abertas
          </span>
          <span
            className="text-[11px] text-[var(--voux-text-faint)]"
            style={{ fontFamily: "var(--voux-font-mono)", letterSpacing: "0.02em" }}
          >
            {aberto
              ? "Negocios comerciais Em Andamento · pinos agrupados por cliente"
              : "Clique para carregar o mapa (o Leaflet so monta ao abrir)"}
          </span>
        </span>
      </button>

      {aberto && (
        <div id="mapa-oportunidades-painel" className="px-5 pb-5">
          {/* Toggle de filtro dentro do painel */}
          <div className="mb-3">
            <ChipToggle
              options={FILTRO_OPTIONS}
              value={filtro}
              onChange={setFiltro}
              ariaLabel="Filtrar pinos do mapa"
            />
          </div>

          {isLoading && (
            <Skeleton className="w-full rounded-[20px]" style={{ height: 520, background: "var(--voux-skeleton)" }} />
          )}

          {!isLoading && error && <BiGestaoErro error={error} contexto="os pinos do mapa" />}

          {!isLoading && !error && (
            <>
              <MapView
                mapView="oportunidades"
                setMapView={() => {}}
                clientePoints={[]}
                regions={[]}
                oportunidades={singlePoints}
                center={CENTRO}
                zoom={7}
                preferCanvas
                hideModeSwitch
                fullscreen={fullscreen}
                toggleFullscreen={() => setFullscreen((v) => !v)}
                onRegionClick={() => {}}
              >
                {clusterGroups.map((g) => (
                  <ClusterMarker key={g.key} points={g.points} lat={g.lat} lng={g.lng} />
                ))}
              </MapView>
              <p className="mt-3 text-[11px] leading-relaxed text-[var(--voux-text-muted)]">
                {fmtNum(data?.comCoordenada ?? 0)} de {fmtNum(data?.total ?? 0)} oportunidades
                {filtro === "periodo" ? " tocadas no periodo" : " abertas"} estao plotadas (
                {fmtBRL(data?.valorNoMapa ?? 0)} de {fmtBRL(data?.valorTotal ?? 0)}).{" "}
                {(data?.semCoordenada ?? 0) > 0 && (
                  <strong className="text-[var(--voux-text-primary)]">
                    {fmtNum(data?.semCoordenada ?? 0)} nao aparecem no mapa por falta de coordenada do
                    cliente.
                  </strong>
                )}{" "}
                Coordenada resolvida pela ultima acao geolocalizada do cliente (
                {fmtNum(data?.meta.viaAcao ?? 0)}) e, na falta dela, pelo cadastro da carteira (
                {fmtNum(data?.meta.viaCarteira ?? 0)}). Raio do circulo = faixa de valor; vermelho = 90+ dias
                sem acao.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
