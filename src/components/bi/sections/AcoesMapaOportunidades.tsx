import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { MapView } from "@/components/dashboard/mapa";
import type { OportunidadePoint } from "@/components/dashboard/mapa";
import { useAcoesMapaRpc } from "@/hooks/bi/useAcoesMapaRpc";
import { fmtBRL, fmtNum } from "@/lib/formatters";
import type { AcoesMapaPino } from "@/types/biRpc";

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

interface Props {
  vendedor?: string;
  cidade?: string;
  active?: boolean;
}

/**
 * Mapa das oportunidades abertas (pedido 6), COLAPSADO por padrao.
 *
 * O Leaflet so monta — e a RPC so roda — quando o bloco abre: sao ~2.240 pinos
 * e uma malha de tiles que nao podem pesar o carregamento de uma tela que ja
 * tem 7 graficos e 4 tabelas.
 *
 * Mostra o ESTOQUE de oportunidades vivas, nao o fluxo do periodo: a RPC nao
 * aceita janela de datas de proposito (restringir a "tocados no periodo"
 * esconderia justamente o negocio parado, que e o alvo do mapa).
 */
export function AcoesMapaOportunidades({ vendedor, cidade, active = true }: Props) {
  const [aberto, setAberto] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const { data, isLoading, error } = useAcoesMapaRpc({
    vendedor,
    cidade,
    enabled: active && aberto,
  });

  const points = useMemo(() => toPoints(data?.pinos ?? []), [data]);

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
              ? "Negocios comerciais Em Andamento · estoque atual, nao o periodo filtrado"
              : "Clique para carregar o mapa (o Leaflet so monta ao abrir)"}
          </span>
        </span>
      </button>

      {aberto && (
        <div id="mapa-oportunidades-painel" className="px-5 pb-5">
          {isLoading && (
            <Skeleton className="w-full rounded-[20px]" style={{ height: 520, background: "var(--voux-skeleton)" }} />
          )}

          {!isLoading && error && (
            <div role="alert" className="rounded-xl border border-[var(--voux-danger)]/40 p-4 text-xs">
              <p className="font-medium text-[var(--voux-text-primary)]">
                Nao foi possivel carregar os pinos do mapa.
              </p>
              <p className="mt-1 text-[var(--voux-text-muted)]">
                Isto NAO significa “nenhuma oportunidade aberta” — a consulta falhou.
              </p>
              <p className="mt-1 break-all font-mono text-[11px] text-[var(--voux-text-muted)]">{error.message}</p>
            </div>
          )}

          {!isLoading && !error && (
            <>
              <MapView
                mapView="oportunidades"
                setMapView={() => {}}
                clientePoints={[]}
                regions={[]}
                oportunidades={points}
                center={CENTRO}
                zoom={7}
                preferCanvas
                hideModeSwitch
                fullscreen={fullscreen}
                toggleFullscreen={() => setFullscreen((v) => !v)}
                onRegionClick={() => {}}
              />
              <p className="mt-3 text-[11px] leading-relaxed text-[var(--voux-text-muted)]">
                {fmtNum(data?.comCoordenada ?? 0)} de {fmtNum(data?.total ?? 0)} oportunidades abertas estao
                plotadas ({fmtBRL(data?.valorNoMapa ?? 0)} de {fmtBRL(data?.valorTotal ?? 0)}).{" "}
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
