import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MapView } from "@/components/dashboard/mapa/MapView";
import type { ClientePoint, MapRegion } from "@/components/dashboard/mapa/types";

/**
 * `MapView` e COMPARTILHADO: /bi/acoes usa o modo `oportunidades` e /crm/mapa
 * usa `clientes` e `regioes`. Os tres passam pelo mesmo cache de icone. Este
 * teste existe para que uma otimizacao no mapa de um nao apague os pinos do
 * outro — em especial a cor: `clientes` passa a CSS custom property
 * `var(--voux-champagne-400)` e `regioes` passa uma cor por nivel, arbitraria.
 * Como aqui e divIcon (SVG no DOM), `var()` e resolvido pelo navegador e a cor
 * CRUA deve chegar intacta ao html. Normalizar para hex no cache mudaria o que
 * e pintado; e o inverso da armadilha 10 da doc (canvas, que nao resolve
 * `var()` e cai em preto).
 */

const clientes: ClientePoint[] = [
  { cliente: "A", cidade: "Chapeco", lat: -27.1, lng: -52.6, ultimaAcao: "2026-09-01", totalAcoes: 3 },
  { cliente: "B", cidade: "Xanxere", lat: -26.8, lng: -52.4, ultimaAcao: "", totalAcoes: 1 },
];
const regioes: MapRegion[] = [
  { cidade: "Chapeco", lat: -27.1, lng: -52.6, totalAcoes: 10, clientes: 5, pipeline: 2e6, visitas: 4, color: "#b83a28", level: "Alta" },
  { cidade: "Xanxere", lat: -26.8, lng: -52.4, totalAcoes: 2, clientes: 1, pipeline: 5e3, visitas: 1, color: "#d4b896", level: "Baixa" },
];

describe("/crm/mapa (vizinho) — MapView compartilhado", () => {
  it("modo clientes renderiza pinos com a cor champagne CRUA", () => {
    const { container } = render(
      <MapView mapView="clientes" setMapView={() => {}} clientePoints={clientes} regions={[]}
        center={[-27, -52]} fullscreen={false} toggleFullscreen={() => {}} onRegionClick={() => {}} />,
    );
    const pinos = container.querySelectorAll(".leaflet-marker-icon");
    expect(pinos.length).toBe(2);
    expect(container.innerHTML).toContain("var(--voux-champagne-400)");
    expect(container.innerHTML).not.toContain("#000000");
  });

  it("modo regioes usa a cor de CADA regiao (N cores arbitrarias)", () => {
    const { container } = render(
      <MapView mapView="regioes" setMapView={() => {}} clientePoints={[]} regions={regioes}
        center={[-27, -52]} fullscreen={false} toggleFullscreen={() => {}} onRegionClick={() => {}} />,
    );
    expect(container.querySelectorAll(".leaflet-marker-icon").length).toBe(2);
    expect(container.innerHTML).toContain("#b83a28");
    expect(container.innerHTML).toContain("#d4b896");
  });

  it("fullscreen monta o segundo mapa sem quebrar", () => {
    const { container } = render(
      <MapView mapView="clientes" setMapView={() => {}} clientePoints={clientes} regions={[]}
        center={[-27, -52]} fullscreen toggleFullscreen={() => {}} onRegionClick={() => {}} />,
    );
    expect(container.querySelectorAll(".leaflet-container").length).toBe(2);
  });
});
