import { describe, expect, it } from "vitest";
import { clusterByCoord, toPoints } from "@/components/bi/sections/acoesMapaRuntime";
import type { AcoesMapaPino } from "@/types/biRpc";

const pin = (lat: number, lon: number): AcoesMapaPino => ({
  negocio: "N-1",
  cliente: "Cliente",
  cidade: "Chapeco",
  etapa: "1-OPORTUNIDADE",
  valor: 0,
  consultor: "Consultor",
  situacao: "aberto",
  acoesNoPeriodo: 0,
  ultimaAcaoPeriodo: null,
  lat,
  lon,
  origemCoord: "carteira",
  diasParado: null,
});
describe("acoes map runtime", () => {
  it("drops invalid coordinates before Leaflet/toFixed receives them", () => {
    const points = toPoints([pin(-27.1, -52.6), pin(Number.NaN, -52.6), pin(-27.1, 181)]);
    expect(points).toHaveLength(1);
    expect(() => clusterByCoord(points)).not.toThrow();
  });

  it("groups valid points sharing a rounded coordinate", () => {
    const points = toPoints([pin(-27.10001, -52.60001), pin(-27.10002, -52.60002)]);
    expect(clusterByCoord(points).size).toBe(1);
  });
});
