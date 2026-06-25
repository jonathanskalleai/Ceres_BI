import type { Registro } from "@/types/comercial";
import type { RpcRegistroRecente } from "@/types/comercialRpc";

/**
 * Maps a RpcRegistroRecente row (from rpc_registros_recentes) to the
 * Registro domain shape used across the BI pages.
 */
export function mapRegistroRecente(r: RpcRegistroRecente): Registro {
  return {
    cliente: r.cliente ?? "",
    cidade: r.cidade ?? "",
    vendedor: r.vendedor ?? "",
    tipoContato: r.tipo_contato ?? "",
    tipoAcao: r.tipo_acao ?? "",
    negocioValor: r.negocio_valor ?? 0,
    negocioEtapa: r.negocio_etapa ?? "",
    dtConclusao: r.dt_conclusao ?? "",
    obs: r.obs ?? "",
    lat: r.lat ?? undefined,
    lng: r.lng ?? undefined,
    status: r.status ?? undefined,
    nroNegocio: r.nro_negocio ?? undefined,
  };
}
