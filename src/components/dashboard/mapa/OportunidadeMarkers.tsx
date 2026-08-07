import { useMemo } from "react";
import { CircleMarker, Popup, Tooltip as LTooltip } from "react-leaflet";
import { useTheme } from "@/hooks/useTheme";
import { formatCurrency, type OportunidadePoint } from "./types";

/** Dias sem acao a partir dos quais o pino vira alerta visual. */
const PARADO_ALERTA_DIAS = 90;

/**
 * Fallbacks = valor atual das vars no `index.css`. So entram em cena antes do
 * CSS aplicar (ou em ambiente sem DOM); um pino champagne levemente fora do
 * tema e infinitamente melhor que a bolinha preta do default do canvas.
 */
const FALLBACK_ALERTA = "#b83a28"; // --voux-danger
const FALLBACK_NORMAL = "#d4b896"; // --voux-champagne-400

/**
 * Resolve uma CSS custom property para o valor COMPUTADO (hex).
 *
 * O `CircleMarker` do Leaflet com `preferCanvas` desenha via
 * `ctx.fillStyle`/`strokeStyle`, e **Canvas 2D nao resolve `var()`**: a
 * atribuicao e descartada em silencio e o contexto fica no default `#000000`.
 * Passar "var(--voux-danger)" aqui pintava TODOS os pinos de preto — e o
 * rodape do card seguia prometendo "vermelho = 90+ dias sem acao", ou seja,
 * uma legenda que a tela nao entregava. Em BI, afirmacao falsa e pior que
 * omissao. (Os modos com `divIcon` nao passam por isso: la e DOM, e o browser
 * resolve a var normalmente.)
 *
 * `getPropertyValue` devolve com espaco a esquerda — o `.trim()` nao e enfeite.
 */
function resolveCssVar(nome: string, fallback: string): string {
  if (typeof window === "undefined" || typeof document === "undefined") return fallback;
  const valor = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  return valor || fallback;
}

/** Raio por faixa de valor — o negocio grande precisa saltar no mapa. */
function raio(valor: number | null): number {
  if (valor == null || valor <= 0) return 4;
  if (valor >= 500_000) return 9;
  if (valor >= 100_000) return 7;
  return 5;
}

function labelDias(diasParado: number | null): string {
  return diasParado == null ? "sem acao registrada" : `${diasParado.toLocaleString("pt-BR")} dias parado`;
}

/**
 * Pinos das oportunidades abertas.
 *
 * `CircleMarker` (vetor, renderizado no canvas do Leaflet) em vez de
 * `divIcon`/`createPinIcon`: sao ~2.240 negocios abertos, e 2.240 nos de DOM
 * com SVG inline travam pan e zoom no mapa. O `preferCanvas` do MapContainer
 * so vale para camadas vetoriais — divIcon continuaria sendo DOM.
 */
export function OportunidadeMarkers({ oportunidades }: { oportunidades: OportunidadePoint[] }) {
  // Resolvido NO RENDER, com o tema como gatilho de re-resolucao — nunca numa
  // constante de modulo, que congelaria a cor do primeiro tema carregado.
  //
  // RESSALVA MEDIDA no CSS buildado (2026-07-25): hoje o gatilho nao muda cor
  // nenhuma, porque `--voux-danger` nao muda com o tema. Mecanismo real:
  //   - o bundle tem ZERO `@layer` (`grep -c '@layer' dist/assets/*.css` -> 0):
  //     em Tailwind 3, `@layer base` e diretiva do proprio Tailwind, nao cascade
  //     layer nativa — o PostCSS remove e ica o conteudo para a posicao do
  //     `@tailwind base`;
  //   - depois do icamento, `.dark` cai no byte 29581 e o `:root` nao-layered no
  //     75555. `:root` e `.dark` tem especificidade IDENTICA (0,1,0), entao quem
  //     decide e a ORDEM DE ORIGEM — e o `:root` vem depois. Ele vence.
  // Alcance exato: 2 tokens, `--voux-danger` e `--voux-success` (os unicos
  // declarados nos dois blocos com valores diferentes). NAO e a aplicacao
  // inteira, como eu havia escrito antes de medir.
  // Fica reportado, nao consertado de carona: mexer na ordem/estrutura do
  // index.css mudaria cor de outras telas e merece demanda propria.
  // A dependencia de tema continua porque custa zero e passa a funcionar
  // sozinha no dia em que o index.css for arrumado.
  const { isDark } = useTheme();
  const cores = useMemo(() => {
    // `isDark` nao entra na conta: ele E a conta. O que muda com o tema e o
    // valor COMPUTADO da var, que so o getComputedStyle abaixo enxerga.
    void isDark;
    return {
      alerta: resolveCssVar("--voux-danger", FALLBACK_ALERTA),
      normal: resolveCssVar("--voux-champagne-400", FALLBACK_NORMAL),
    };
  }, [isDark]);

  const cor = (diasParado: number | null): string =>
    diasParado != null && diasParado >= PARADO_ALERTA_DIAS ? cores.alerta : cores.normal;

  return (
    <>
      {oportunidades.map((o) => (
        <CircleMarker
          key={o.negocio}
          center={[o.lat, o.lng]}
          radius={raio(o.valor)}
          pathOptions={{
            color: cor(o.diasParado),
            fillColor: cor(o.diasParado),
            fillOpacity: 0.55,
            weight: 1.2,
          }}
        >
          <LTooltip direction="top">
            <div className="text-xs">
              <strong>{o.cliente ?? "Cliente nao identificado"}</strong>
              <br />
              {o.valor != null ? formatCurrency(o.valor) : "sem valor"} · {labelDias(o.diasParado)}
            </div>
          </LTooltip>
          <Popup>
            <div className="min-w-[200px] space-y-1 text-xs">
              <p className="text-sm font-bold">{o.cliente ?? "Cliente nao identificado"}</p>
              <p>Negocio: <strong>{o.negocio}</strong></p>
              <p>Valor: <strong>{o.valor != null ? formatCurrency(o.valor) : "—"}</strong></p>
              <p>Etapa: <strong>{o.etapa ?? "—"}</strong></p>
              <p>Cidade: <strong>{o.cidade ?? "—"}</strong></p>
              <p>Consultor: <strong>{o.consultor ?? "sem atribuicao"}</strong></p>
              <p>Parado: <strong>{labelDias(o.diasParado)}</strong></p>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}
