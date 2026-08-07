# AIVOUX — Tool Response Filtering

Reduz consumo de tokens ao processar respostas grandes de ferramentas.
Aplique estas regras apos receber qualquer resposta de WebFetch, MCP ou busca.

## Regra Geral

Ao receber resposta de ferramenta com mais de ~500 tokens:
1. Extrair apenas o conteudo relevante para a tarefa atual
2. Descartar: navegacao, rodapes, headers repetitivos, boilerplate
3. Limitar output extraido a ~800 tokens salvo necessidade explicita
4. NUNCA repetir o payload bruto completo no seu raciocinio

## Por Tipo de Ferramenta

### WebFetch (HTML/docs)
- Extrair: conteudo principal, exemplos de codigo, secoes relevantes a tarefa
- Descartar: menu de navegacao, sidebar, footer, banners, links externos
- Limite: ~800 tokens do conteudo extraido

### WebSearch
- Usar apenas os 3-5 resultados mais relevantes
- Extrair: titulo + snippet relevante por resultado
- Descartar: URLs duplicadas, resultados off-topic

### MCP tools (Supabase, GitHub, etc.)
- Para listas: mostrar apenas campos necessarios para a tarefa
- Para objetos grandes: extrair apenas as chaves relevantes
- Para arrays: limitar a 10-20 itens salvo necessidade de todos

## Fallback

Se o filtro removeria todo o conteudo util: usar resposta completa sem filtrar.
Nunca produzir resultado vazio por excesso de filtragem.

## Exemplo

WebFetch retorna 4.000 tokens de documentacao.
Tarefa: entender como usar `useCallback`.
Acao: extrair apenas a secao useCallback (~300 tokens), descartar o resto.
