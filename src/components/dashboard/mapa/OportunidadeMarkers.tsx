import { Marker, Popup, Tooltip as LTooltip } from "react-leaflet";
import { createPinIcon, formatCurrency, OPORTUNIDADE_ABERTA_PIN_COLOR, type OportunidadePoint } from "./types";

function labelDias(diasParado: number | null): string {
  return diasParado == null ? "sem acao registrada" : `${diasParado.toLocaleString("pt-BR")} dias parado`;
}

function labelSituacao(situacao: OportunidadePoint["situacao"]): string {
  if (situacao === "ganho") return "Ganho";
  if (situacao === "perdido") return "Perdido";
  return "Em andamento";
}

function corSituacao(situacao: OportunidadePoint["situacao"]): string {
  if (situacao === "ganho") return "var(--voux-success)";
  if (situacao === "perdido") return "var(--voux-danger)";
  return OPORTUNIDADE_ABERTA_PIN_COLOR;
}

/** Mesmo conteúdo no hover e no clique: o clique fica apenas como alternativa. */
function OportunidadeInfo({ oportunidade }: { oportunidade: OportunidadePoint }) {
  return (
    <div className="min-w-[200px] space-y-1 text-xs">
      <p className="text-sm font-bold">{oportunidade.cliente ?? "Cliente nao identificado"}</p>
      <p>Negocio: <strong>{oportunidade.negocio}</strong></p>
      <p>Valor: <strong>{oportunidade.valor != null ? formatCurrency(oportunidade.valor) : "—"}</strong></p>
      <p>Etapa: <strong>{oportunidade.etapa ?? "—"}</strong></p>
      <p>Status: <strong>{labelSituacao(oportunidade.situacao)}</strong></p>
      <p>Acoes no periodo: <strong>{oportunidade.acoesNoPeriodo}</strong></p>
      <p>Cidade: <strong>{oportunidade.cidade ?? "—"}</strong></p>
      <p>Consultor: <strong>{oportunidade.consultor ?? "sem atribuicao"}</strong></p>
      <p>Parado: <strong>{labelDias(oportunidade.diasParado)}</strong></p>
    </div>
  );
}

/**
 * Pinos dos negócios que tiveram ação no período. O recorte é naturalmente
 * menor que o antigo estoque inteiro, então o marcador de localização é mais
 * legível do que as bolinhas e ainda deixa ganho/perdido inequívocos.
 */
export function OportunidadeMarkers({ oportunidades }: { oportunidades: OportunidadePoint[] }) {
  return (
    <>
      {oportunidades.map((o) => (
        <Marker
          key={o.negocio}
          position={[o.lat, o.lng]}
          icon={createPinIcon(corSituacao(o.situacao))}
        >
          <LTooltip direction="top" offset={[0, -42]} className="mapa-oportunidade-tooltip">
            <OportunidadeInfo oportunidade={o} />
          </LTooltip>
          <Popup>
            <OportunidadeInfo oportunidade={o} />
          </Popup>
        </Marker>
      ))}
    </>
  );
}
