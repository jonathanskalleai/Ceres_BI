# Auditoria de desempenho e confiabilidade do BI — 2026-09-22

## Resultado executivo

O atraso observado no F5 não é explicado por saturação contínua do PostgreSQL.
Na reprodução em produção, o site estático respondeu em cerca de 0,7 s e a
RPC principal de Desempenho executou no banco em aproximadamente 0,8–1,5 s.
Em contraste, o endpoint público do Supabase ficou 20 s sem entregar bytes em
uma amostra, e o browser registrou `TypeError: Failed to fetch` durante o
refresh de sessão e o carregamento do perfil. Quando isso ocorre, a tela fica
com o cabeçalho e os blocos sem dados até as chamadas expirarem.

## Evidências coletadas

- Serviços `ceresbi_web`, `ceresbi_ai`, Kong, PostgREST e PostgreSQL: `1/1`.
- VPS no instante da coleta: memória disponível, sem pressão de CPU ou swap.
- PostgreSQL: `max_connections=100`, sem deadlocks; as conexões aguardando eram
  majoritariamente `idle / ClientRead`, portanto não bloqueios de SQL.
- PostgREST: pool máximo de 10 conexões.
- `rpc_desempenho_vendas_bi`: média histórica observada de ~0,8–1,1 s nas
  chamadas com os filtros da tela.
- `rpc_acoes_mapa_oportunidades`: ~0,4 s sem vendedor e ~0,8 s com vendedor em
  `EXPLAIN ANALYZE`; o histórico tem pico isolado de ~6 s, indicando uma
  segunda frente de otimização, mas não o motivo do F5 ficar sem cabeçalho.
- Ações abre uma onda inicial e uma onda atrasada de RPCs; o mapa começa aberto
  e entra na segunda onda (900 ms), junto com detalhe, risco, IA e período
  anterior.

## Causa corrigida

O browser chamava `ceressupabasebi.vouxconsultoria.com.br` em um segundo caminho
público de DNS/TLS. Esse caminho apresentou intermitência de transporte,
enquanto `ceresbi.vouxconsultoria.com.br` permanecia saudável. A correção
preparada faz o SDK de produção usar `/supabase` no próprio domínio do BI; o
Nginx encaminha o prefixo ao Kong pela rede privada `redeinterna`. Fora de
produção, o endpoint configurado continua sendo usado. A chave local de sessão
permanece a mesma para não deslogar usuários existentes. O proxy mantém o
mesmo limite de 50 req/s com burst 100 do endpoint público.

## Pendências de performance SQL

1. Medir P50/P95/P99 das RPCs durante horário de uso após o proxy entrar em
   produção, separando tempo de rede, Kong/PostgREST e execução do banco.
2. Otimizar `rpc_acoes_mapa_oportunidades`: a função materializa várias CTEs,
   recalcula coordenadas históricas e usa casts de data; validar índices e plano
   com o volume real antes de alterar a regra de negócio.
3. Evitar que o mapa seja carregado aberto por padrão quando o usuário só quer
   os cards; a consulta já está atrasada, mas ainda é uma RPC pesada na mesma
   recarga.
4. Quebrar os contêineres de página que excedem 400 linhas (`AcoesSection` e
   `BiDesempenhoVendas`) em componentes menores em uma etapa separada, sem
   misturar refatoração estrutural com a correção de transporte.

## Validação pós-publicação

- `/supabase/auth/v1/health` no domínio do BI deve responder rapidamente (401
  sem chave é esperado).
- Login/sessão, `rpc_desempenho_vendas_bi` e pelo menos uma RPC de Ações devem
  responder pelo prefixo same-origin.
- Recarregar `/bi/desempenho` e `/bi/acoes` três vezes, observando que cards,
  gráficos e mapa aparecem sem o estado permanente de carregamento.
- Confirmar `ceresbi_web` e `ceresbi_ai` `1/1`, imagem no SHA publicado, `/` 200
  e `/api/ai/health` 200.
