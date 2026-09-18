import { useState } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import L from "leaflet";
import { MapContainer } from "react-leaflet";
import { OportunidadeMarkers } from "@/components/dashboard/mapa/OportunidadeMarkers";
import { createPinIcon, type OportunidadePoint } from "@/components/dashboard/mapa/types";

/**
 * Teste de regressao da performance de render do mapa de /bi/acoes.
 *
 * O custo que derrubava a tela nao era a RPC (medida entre 7ms e 341ms): era o
 * `Marker` do react-leaflet chamando `setIcon()` em todo pino a cada render do
 * pai. `setIcon` dispara `_initIcon()` no Leaflet, que remove o elemento do
 * pane, recria, re-registra a interacao e re-executa `bindPopup()`. Contar
 * `setIcon` e `setLatLng` e a forma de provar com NUMERO que a cascata parou —
 * "parece mais rapido" nao e evidencia.
 */

const ponto = (i: number, situacao: OportunidadePoint["situacao"] = "aberto"): OportunidadePoint => ({
  negocio: `NEG-${i}`,
  cliente: `Cliente ${i}`,
  cidade: "Chapeco",
  etapa: "Negociacao",
  valor: 1000 * i,
  consultor: "Consultor",
  situacao,
  acoesNoPeriodo: 2,
  ultimaAcaoPeriodo: "2026-09-01",
  lat: -27.1 + i / 1000,
  lng: -52.6,
  diasParado: 12,
});

/**
 * Pai que re-renderiza sem mudar os dados — exatamente o que a `AcoesSection`
 * fazia a cada medicao do ResizeObserver e a cada onda de `useDelayedReady`.
 */
function PaiQueRerenderiza({ pontos }: { pontos: OportunidadePoint[] }) {
  const [, setTick] = useState(0);
  return (
    <>
      <button type="button" onClick={() => setTick((t) => t + 1)}>
        forcar render
      </button>
      <MapContainer center={[-27.1, -52.6]} zoom={7}>
        <OportunidadeMarkers oportunidades={pontos} />
      </MapContainer>
    </>
  );
}

let setIconSpy: ReturnType<typeof vi.spyOn>;
let setLatLngSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  setIconSpy = vi.spyOn(L.Marker.prototype, "setIcon");
  setLatLngSpy = vi.spyOn(L.Marker.prototype, "setLatLng");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OportunidadeMarkers — custo de re-render", () => {
  it("nao recria nenhum icone quando o pai re-renderiza sem mudar os dados", () => {
    const pontos = [ponto(1), ponto(2), ponto(3), ponto(4), ponto(5)];
    render(<PaiQueRerenderiza pontos={pontos} />);

    // Baseline: a montagem inicial cria os pinos e nao passa por setIcon.
    setIconSpy.mockClear();
    setLatLngSpy.mockClear();

    const botao = screen.getByRole("button", { name: "forcar render" });
    for (let i = 0; i < 3; i++) fireEvent.click(botao);

    // Antes do fix: 5 pinos x 3 renders = 15 setIcon (cada um destruindo e
    // recriando o no do DOM). Depois: 0.
    expect(setIconSpy).toHaveBeenCalledTimes(0);
    expect(setLatLngSpy).toHaveBeenCalledTimes(0);
  });

  it("nao recria icone quando o array e novo mas os pontos sao os mesmos", () => {
    // Caso real: um `useMemo` reavaliado devolve um array novo com os mesmos
    // objetos. A identidade do array muda, a do dado nao.
    const pontos = [ponto(1), ponto(2), ponto(3)];
    const { rerender } = render(<PaiQueRerenderiza pontos={pontos} />);

    setIconSpy.mockClear();
    setLatLngSpy.mockClear();

    rerender(<PaiQueRerenderiza pontos={[...pontos]} />);

    expect(setIconSpy).toHaveBeenCalledTimes(0);
    expect(setLatLngSpy).toHaveBeenCalledTimes(0);
  });
});

describe("createPinIcon — cache por cor", () => {
  it("devolve a MESMA instancia para a mesma cor", () => {
    // A identidade e o que o react-leaflet compara (`props.icon !== prevProps.icon`).
    expect(createPinIcon("#2563eb")).toBe(createPinIcon("#2563eb"));
  });

  it("devolve instancias diferentes para cores diferentes", () => {
    expect(createPinIcon("#2563eb")).not.toBe(createPinIcon("var(--voux-success)"));
  });

  it("preserva a cor CRUA no html, inclusive CSS custom property", () => {
    // O modo `clientes` de /crm/mapa passa `var(--voux-champagne-400)`. Aqui e
    // divIcon (SVG no DOM), que RESOLVE `var()`; converter para hex mudaria o
    // que e pintado. A armadilha do `var()` virando preto e do canvas.
    const html = createPinIcon("var(--voux-champagne-400)").options.html as string;
    expect(html).toContain("var(--voux-champagne-400)");
  });
});
