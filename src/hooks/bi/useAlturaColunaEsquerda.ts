import { useEffect, useRef } from "react";

/**
 * No desktop o termômetro é uma lista rolável ao lado de dois cards com altura
 * variável. CSS não consegue atrelar a altura máxima de um irmão à altura real
 * do outro sem deixar o conteúdo da direita definir a linha do grid. A medição
 * mantém o fim dos dois lados alinhado mesmo quando textos ou dados mudam.
 *
 * A altura é escrita DIRETO no style do elemento alvo, sem passar por estado.
 * Antes ela era `useState` na seção inteira: cada medição re-renderizava a
 * `AcoesSection` (e com ela o mapa, que recriava todos os pinos), e como o mapa
 * e os cards mudam de altura conforme as respostas chegam, uma medição
 * disparava outra. O layout não precisa do valor em React — só o nó do DOM
 * precisa. Sem estado, o ResizeObserver deixa de ser um gatilho de render.
 *
 * `medidoRef` vai no bloco que define a altura (coluna da esquerda);
 * `alvoRef` no bloco que deve acompanhá-la.
 */
export function useAlturaColunaEsquerda() {
  const medidoRef = useRef<HTMLDivElement>(null);
  const alvoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const medido = medidoRef.current;
    if (!medido) return;

    const desktop = window.matchMedia("(min-width: 1024px)");
    const medir = () => {
      const alvo = alvoRef.current;
      if (!alvo) return;

      if (!desktop.matches) {
        // Mobile empilha: a altura casada atrapalharia, então volta ao natural.
        alvo.style.height = "";
        return;
      }

      const proximaAltura = `${Math.ceil(medido.getBoundingClientRect().height)}px`;
      if (alvo.style.height !== proximaAltura) alvo.style.height = proximaAltura;
    };

    const observador = new ResizeObserver(medir);
    observador.observe(medido);
    desktop.addEventListener("change", medir);
    medir();

    return () => {
      observador.disconnect();
      desktop.removeEventListener("change", medir);
    };
  }, []);

  return { medidoRef, alvoRef };
}
