import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regressao de CSP: o FUNDO do mapa depende de `img-src` no `nginx.conf`.
 *
 * Em 24b2e2c um hardening de seguranca apertou a CSP para
 * `img-src 'self' data: blob:` e as tiles do OSM passaram a ser recusadas pelo
 * navegador. O bug foi para producao e ninguem viu, porque:
 *   - os pinos sao SVG inline via `divIcon`, contam como `'self'` e continuaram
 *     aparecendo (o sintoma que o usuario relatou foi "mostra os pinos mas nao
 *     mostra o mapa");
 *   - CSP nao lanca exception nem cai em `catch`, entao nenhum teste de runtime
 *     e nenhum error tracking acusou;
 *   - jsdom NAO aplica CSP, entao a suite inteira seguiu verde.
 *
 * Por isso este teste nao renderiza nada: ele cruza as DUAS fontes de verdade
 * (a URL do `TileLayer` e a politica servida pelo nginx) e falha se elas
 * divergirem. Trocar de provedor de tile sem liberar o host na CSP — ou apertar
 * a CSP sem olhar o mapa — passa a quebrar o build em vez da tela.
 */

const raiz = resolve(__dirname, "../../../../..");
const nginxConf = readFileSync(resolve(raiz, "nginx.conf"), "utf-8");
const mapViewSrc = readFileSync(resolve(raiz, "src/components/dashboard/mapa/MapView.tsx"), "utf-8");

/** Linhas de CSP do nginx.conf (uma por bloco `location`). */
const linhasCsp = nginxConf
  .split("\n")
  .filter((l) => l.includes("Content-Security-Policy"));

/** `img-src` de uma linha de CSP, sem o `;` final. */
const imgSrcDe = (linhaCsp: string): string => {
  const m = linhaCsp.match(/img-src([^;]*)/);
  if (!m) throw new Error("linha de CSP sem diretiva img-src");
  return m[1].trim();
};

describe("CSP x TileLayer: o fundo do mapa precisa ser permitido", () => {
  it("o nginx.conf declara CSP em todos os blocos location", () => {
    // Se este numero mudar, o teste abaixo (que compara todas entre si) continua
    // valendo; o assert existe para que remover uma CSP nao passe em silencio.
    expect(linhasCsp.length).toBeGreaterThanOrEqual(3);
  });

  it("as CSPs dos blocos location sao IDENTICAS entre si", () => {
    // A CSP e duplicada por bloco (`/assets/`, `/`, `= /index.html`). Editar um
    // e esquecer os outros da bug por rota: a home funciona e o asset nao, ou
    // vice-versa. Foi o risco real ao aplicar o fix em 3 lugares.
    const unicas = new Set(linhasCsp.map((l) => l.trim()));
    expect([...unicas]).toHaveLength(1);
  });

  it("img-src permite o host de tile que o TileLayer realmente pede", () => {
    // Extrai o host da URL usada no codigo, em vez de hardcodar: se alguem trocar
    // o provedor, o teste cobra a CSP nova em vez de continuar verde.
    const urlsTile = [...mapViewSrc.matchAll(/url="(https:\/\/[^"]+)"/g)].map((m) => m[1]);
    expect(urlsTile.length).toBeGreaterThan(0);

    for (const url of urlsTile) {
      // `{s}` e o placeholder de subdominio do Leaflet (a/b/c).
      const host = new URL(url.replace("{s}", "a")).hostname; // ex: a.tile.openstreetmap.org
      const dominioBase = host.split(".").slice(1).join("."); // ex: tile.openstreetmap.org

      for (const linha of linhasCsp) {
        const imgSrc = imgSrcDe(linha);
        const liberado =
          imgSrc.includes(host) || imgSrc.includes(`*.${dominioBase}`) || imgSrc.includes(` ${dominioBase}`);
        expect(liberado, `img-src nao permite ${host} — o fundo do mapa fica cinza`).toBe(true);
      }
    }
  });

  it("img-src continua exigindo https para host externo (sem mixed content)", () => {
    for (const linha of linhasCsp) {
      const imgSrc = imgSrcDe(linha);
      expect(imgSrc).not.toMatch(/\bhttp:\/\//);
    }
  });

  it("o TileLayer do fullscreen usa a MESMA url do mapa normal", () => {
    // O fullscreen monta um segundo MapContainer (armadilha 33). Se as duas URLs
    // divergirem, uma das telas pode ficar sem fundo mesmo com a CSP correta.
    const urls = [...mapViewSrc.matchAll(/url="(https:\/\/[^"]+)"/g)].map((m) => m[1]);
    expect(new Set(urls).size).toBe(1);
  });
});
