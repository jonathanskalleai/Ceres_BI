# AIVOUX - 12 Best Practices (Coding Standards)

Esta e a checklist mestre de qualidade do AIVOUX. **Toda implementacao de codigo
DEVE respeitar estas 12 praticas.** O @dev aplica durante a implementacao,
o @qa valida no review, e o @architect considera no design.

---

## 1. Avoid Code Duplication (DRY)

**Principio:** Don't Repeat Yourself. Codigo duplicado e dificil de manter e propaga bugs.

**Aplicar:**
- Antes de escrever logica, buscar (Grep) por implementacao similar existente
- Extrair logica repetida para funcoes/hooks/utils reutilizaveis
- Limite de tolerancia: se o mesmo padrao aparece **3 vezes**, abstrair
- Componentes UI repetidos viram componentes parametrizados

**Anti-padrao:** Copy-paste de blocos de codigo entre arquivos.

---

## 2. Eliminate Unused Code (Dead Code)

**Principio:** Codigo morto polui a base e confunde o mantenedor.

**Aplicar:**
- Remover imports nao usados
- Deletar funcoes/variaveis/arquivos nao referenciados
- Remover console.log de debug antes de finalizar
- Remover comentarios `// removed`, `// TODO old` apos a mudanca
- Usar lint rules: `no-unused-vars`, `no-dead-code`

**Anti-padrao:** Comentar codigo "por seguranca" ao inves de deletar (git tem o historico).

---

## 3. Consistent Use of TypeScript

**Principio:** Tipagem forte previne bugs em compile-time.

**Aplicar:**
- **Proibido `any`** sem justificativa explicita (usar `unknown` + narrowing)
- Definir `interface` ou `type` para todos os objetos de dominio
- Tipar props de componentes React com `interface ComponentProps`
- Tipar retornos de funcoes assincronas com `Promise<T>`
- Usar generics quando funcoes operam sobre tipos genericos
- Habilitar `strict: true` no tsconfig

**Anti-padrao:** `function foo(data: any): any { ... }`

---

## 4. Well-Structured Components (Tamanho)

**Principio:** Componentes grandes sao dificeis de testar, entender e reusar.

**Aplicar:**
- **Gate obrigatorio (HARD): <300 linhas por arquivo/componente** (incluindo imports).
  Ultrapassar = FAIL no `@reviewer`/`@qa` e aviso do hook `quality-guard`. Sem excecoes silenciosas.
- **Meta ideal: <200 linhas** — para codigo novo, buscar esse limite
- Se aproximar de 300, quebrar em sub-componentes/hooks/utils ANTES de entregar — nao depois
- Cada componente tem uma responsabilidade clara (Single Responsibility)
- Extrair logica complexa para custom hooks
- Componentes "container" (logica) separados de "presentational" (UI)

**Anti-padrao:** `Dashboard.tsx` com 800 linhas fazendo fetch, transforms, e renderizacao.
**Anti-padrao:** entregar arquivo de 290 linhas "porque ainda passa" em vez de quebrar cedo.

---

## 5. Efficient State Management

**Principio:** Estado mal gerenciado causa re-renders desnecessarios e bugs sutis.

**Aplicar:**
- Estado local (`useState`) para coisas locais ao componente
- Context API para estado compartilhado em arvore pequena
- Zustand/Redux/Jotai para estado global complexo
- **Evitar prop drilling >2 niveis** — promover para context ou store
- Derivar estado quando possivel ao inves de duplicar
- Nao usar estado para valores que podem ser calculados

**Anti-padrao:** Passar a mesma prop por 5 niveis de componentes.

---

## 6. Proper Use of React Hooks

**Principio:** Hooks tem regras estritas. Quebrar gera bugs dificeis de rastrear.

**Aplicar:**
- **Rules of Hooks:** sempre no top-level, nunca dentro de loops/conditions
- `useEffect` com array de dependencias **completo e correto** (lint: react-hooks/exhaustive-deps)
- Cleanup em `useEffect` quando ha subscribe/timer/listener
- Custom hooks (`useXxx`) para reutilizar logica entre componentes
- `useMemo`/`useCallback` apenas quando ha problema real de performance medido
- Nao chamar hooks condicionalmente

**Anti-padrao:** `if (cond) { useState(...) }` ou `useEffect(() => {...}, [])` quando depende de props.

---

## 7. Separation of Logic and Presentation

**Principio:** Misturar logica de negocio com UI dificulta testes e manutencao.

**Aplicar:**
- Logica de negocio em **custom hooks** (`useXxx`), UI em **components**
- API calls em hooks dedicados, nao espalhadas diretamente no JSX
- Transforms de dados em funcoes separadas do JSX
- Componentes JSX devem ser declarativos, sem `if/else` complexos no return
- Validacao de forms em hooks/schemas, nao em handlers inline

**Anti-padrao:** `<button onClick={() => { fetch('/api'); transform(); validate(); }}>`

---

## 8. Proper Error Handling

**Principio:** Erros nao tratados degradam UX e escondem bugs reais.

**Aplicar:**
- `try/catch` em todas as operacoes async (fetch, DB, file IO)
- **Error Boundaries** em pontos estrategicos da arvore React
- Mensagens de erro **uteis ao usuario** (nao stack traces)
- Logar erros estruturadamente (sem expor dados sensiveis)
- Diferenciar erros recuperaveis de fatais
- Estados de erro explicitos no UI (nao apenas loading + sucesso)

**Anti-padrao:** `fetch(url).then(r => r.json())` sem `.catch()`.

---

## 9. Performance and Optimizations

**Principio:** Otimizacao prematura e ruim, mas ignorar performance tambem.

**Aplicar:**
- **Medir antes de otimizar** (React DevTools Profiler, Lighthouse)
- `React.memo` para componentes puros que renderizam frequentemente
- `useMemo` para calculos custosos
- `useCallback` para funcoes passadas para componentes memoizados
- Code splitting com `React.lazy` + `Suspense` para rotas
- Imagens com `loading="lazy"` + dimensoes explicitas + formatos modernos (webp/avif)
- Debounce/throttle em handlers de input/scroll
- Virtualizacao (react-window) para listas longas (>100 itens)

**Anti-padrao:** `useMemo` em volta de `a + b` (overhead > beneficio).

---

## 10. Project Organization and Structure

**Principio:** Estrutura clara facilita navegacao e onboarding.

**Aplicar:**
- Seguir a estrutura existente do projeto (`components/`, `hooks/`, `utils/`, `pages/`)
- Convencao de nomes: `PascalCase` para componentes, `camelCase` para hooks/utils
- Imports absolutos com alias `@/` (ex: `@/components/Button`, nao `../../../`)
- `index.ts` para barrel exports quando faz sentido
- Para modulos novos de grande porte: organizar por feature dentro de `components/{feature}/`
- Tests co-localizados com o codigo quando existirem

**Anti-padrao:** Pasta `utils/` com 50 funcoes nao relacionadas; imports relativos longos.

---

## 11. Accessibility (a11y)

**Principio:** Software deve ser usavel por todos. WCAG 2.1 AA e o minimo.

**Aplicar:**
- Tags semanticas (`<button>`, `<nav>`, `<main>`, nao `<div onClick>`)
- `alt` em todas as imagens
- `label` associado a todo input (`<label htmlFor>`)
- Contraste de cores adequado (4.5:1 para texto normal)
- Navegacao por teclado funcional (Tab, Enter, Esc)
- ARIA attributes quando semantica HTML nao basta
- Focus visivel (nao remover `outline` sem substituir)

**Anti-padrao:** `<div onClick={...}>` para botoes.

---

## 12. Adequate Testing

**Principio:** Sem testes, refatorar e arriscado e bugs voltam.

**Aplicar:**
- **Unit tests** para logica de negocio nova e critica (hooks, utils, funcoes puras)
- **E2E tests** para jornadas criticas (Playwright/Cypress quando disponivel)
- Testar **comportamento**, nao implementacao
- Casos: happy path + edge cases + error states
- Test naming: "should X when Y"
- Mocks apenas quando inevitavel; preferir testes integrados

**Gate:** toda logica critica nova (algoritmos de negocio, funcoes de transformacao,
validators) deve ter pelo menos 1 teste unitario no mesmo PR.
Features de UI puras (componentes visuais sem logica) sao isentas de teste obrigatorio.

**Anti-padrao:** Logica de negocio nova sem nenhum teste.

> Meta de longo prazo: 80% de cobertura para logica critica.
> Nao bloquear PRs por ausencia de cobertura em codigo existente nao testado.

---

## Como Esta Checklist e Aplicada

### @dev (durante implementacao)

Antes de marcar tarefa como completa, validar:
- [ ] DRY: nao ha duplicacao com codigo existente
- [ ] Sem dead code (imports/funcoes nao usadas removidos)
- [ ] TypeScript estrito (sem `any` injustificado)
- [ ] Componentes <300 linhas (HARD gate, FAIL acima); meta <200 para codigo novo
- [ ] Estado bem gerenciado (sem prop drilling excessivo)
- [ ] Hooks corretos (deps completas, sem violacao de regras)
- [ ] Logica separada de presentacao
- [ ] Error handling em operacoes async
- [ ] Performance considerada (sem otimizacao prematura)
- [ ] Estrutura segue padrao do projeto
- [ ] A11y basico (semantica, alt, label, contraste)
- [ ] Testes para o que foi implementado

### @qa (durante review)

Cada um dos 7 quality checks do QA inclui validacao destas praticas:
1. Acceptance Criteria + DRY + Dead Code (#1, #2)
2. Tests (#12)
3. CodeRabbit (auxilia em #1, #2, #6, #9)
4. Security (relacionado a #8)
5. NFR (#9, #11)
6. Code Quality (#3, #4, #5, #6, #7, #10)
7. Documentation

### @architect (durante design)

Considerar #4, #5, #7, #9, #10 ao desenhar:
- Componentes serao bem estruturados?
- Estrategia de estado faz sentido?
- Separacao logica/UI no design?
- Performance considerada na arquitetura?
- Estrutura de pastas definida?

---

## Referencias Externas

- [React Hooks Rules](https://react.dev/reference/rules/rules-of-hooks)
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Testing Library Principles](https://testing-library.com/docs/guiding-principles/)
