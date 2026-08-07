import { describe, it, expect } from "vitest";
import { mapRegistroRecente } from "../comercialMappers";
import type { RpcRegistroRecente } from "@/types/comercialRpc";

describe("mapRegistroRecente", () => {
  const fullRow: RpcRegistroRecente = {
    cliente: "Fazenda Sol",
    cidade: "Uberlandia",
    vendedor: "Carlos",
    tipo_contato: "Telefone",
    tipo_acao: "Visita",
    negocio_valor: 150000,
    negocio_etapa: "Proposta",
    dt_conclusao: "2024-06-15",
    obs: "Cliente interessado",
    lat: -18.91,
    lng: -48.27,
    status: "Concluida",
    nro_negocio: "NGO-001",
  };

  it("should map all fields correctly from a complete RPC row", () => {
    const result = mapRegistroRecente(fullRow);
    expect(result).toEqual({
      cliente: "Fazenda Sol",
      cidade: "Uberlandia",
      vendedor: "Carlos",
      tipoContato: "Telefone",
      tipoAcao: "Visita",
      negocioValor: 150000,
      negocioEtapa: "Proposta",
      dtConclusao: "2024-06-15",
      obs: "Cliente interessado",
      lat: -18.91,
      lng: -48.27,
      status: "Concluida",
      nroNegocio: "NGO-001",
    });
  });

  it("should default nullable string fields to empty string", () => {
    const row: RpcRegistroRecente = {
      cliente: "Test",
      cidade: "SP",
      vendedor: "V",
      tipo_contato: "Email",
      tipo_acao: "Ligacao",
      negocio_valor: null,
      negocio_etapa: null,
      dt_conclusao: "2024-01-01",
      obs: null,
      lat: null,
      lng: null,
      status: null,
      nro_negocio: null,
    };
    const result = mapRegistroRecente(row);
    expect(result.negocioValor).toBe(0);
    expect(result.negocioEtapa).toBe("");
    expect(result.obs).toBe("");
    expect(result.lat).toBeUndefined();
    expect(result.lng).toBeUndefined();
    expect(result.status).toBeUndefined();
    expect(result.nroNegocio).toBeUndefined();
  });

  it("should handle zero negocio_valor correctly (not coerce to default)", () => {
    const row: RpcRegistroRecente = {
      ...fullRow,
      negocio_valor: 0,
    };
    const result = mapRegistroRecente(row);
    expect(result.negocioValor).toBe(0);
  });

  it("should preserve coordinate values when provided", () => {
    const result = mapRegistroRecente(fullRow);
    expect(result.lat).toBe(-18.91);
    expect(result.lng).toBe(-48.27);
  });
});
