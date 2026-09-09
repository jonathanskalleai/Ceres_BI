# Baseline de implementação — Agente Analítico v2

**Data:** 08/09/2026  
**Branch:** `release/bi-consolidacao-fase-1`  
**Escopo:** somente registro; não representa aprovação de release

## Checks

- `python3.12 -m unittest discover -s ai-service/tests -v`: **53 testes OK**
  em ambiente temporário com as dependências de `ai-service/requirements.txt`.
- `npm test -- --reporter=dot`: **22 arquivos / 195 testes OK**.
- `npm run build`: **OK**; Vite emite apenas o aviso existente de chunks acima
  de 500 kB.
- `npm run lint`: **FAIL preexistente**, 126 erros e 26 avisos em arquivos fora
  do escopo desta implementação, incluindo uso de `any` e regras de componentes.
- `python3 -m pytest -q`: **não executável** porque o Python 3.14 global não
  possui `pytest`; o baseline equivalente foi executado com `unittest`.

## Inventário de runtime (somente leitura)

- Container local consultado: `backend-postgres-1`, database `vouxbi_ixc`,
  usuário `vouxbi`, PostgreSQL 16.14.
- O banco local não possui as RPCs do BI nem as tabelas `mirror`/`ya_*`.
- `DATABASE_URL`, `OPENROUTER_API_KEY` e `SUPABASE_JWT_SECRET` não estão
  disponíveis no ambiente desta sessão.
- Nenhuma migration foi aplicada e nenhum endpoint foi publicado.

## Consequência

A2, C1 e os smokes autenticados de F1–F10 permanecem pendentes de um ambiente
de preview com o Postgres do BI e o provedor configurados. Os testes locais da
v2 devem usar contratos mockados e nunca transformar migrations históricas em
fonte de verdade.
