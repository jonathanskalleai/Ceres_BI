import { isValidCoordinate } from "@/lib/bi/runtime";
import type { OportunidadePoint } from "@/components/dashboard/mapa/types";
import type { AcoesMapaPino } from "@/types/biRpc";

/** Converte apenas pinos geograficamente válidos para o contrato do mapa. */
export function toPoints(pinos: AcoesMapaPino[]): OportunidadePoint[] {
  const points: OportunidadePoint[] = [];
  for (const p of pinos) {
    if (!isValidCoordinate(p?.lat, p?.lon)) continue;
    points.push({
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
    });
  }
  return points;
}
/** Agrupa pinos por coordenada arredondada (~11m de resolução). */
export function clusterByCoord(points: OportunidadePoint[]): Map<string, OportunidadePoint[]> {
  const map = new Map<string, OportunidadePoint[]>();
  for (const p of points) {
    if (!isValidCoordinate(p.lat, p.lng)) continue;
    const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
    const arr = map.get(key);
    if (arr) arr.push(p);
    else map.set(key, [p]);
  }
  return map;
}
