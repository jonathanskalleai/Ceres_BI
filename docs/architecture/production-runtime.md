# Runtime de producao — Ceres BI

> Fotografia verificada por acesso read-only na VPS em 2026-08-02. Este documento
> descreve o que esta em execucao, nao uma proposta de infraestrutura.

## Visao geral

```text
Campos Dealer (SQL Server)
        |
        |  cron do host, a cada 15 min
        v
Python ETL /opt/etl-stack (5 blocos paralelos, imagem etl-ceres:v15)
        |
        v
Postgres mirror no Supabase self-hosted (VPS / Docker Swarm)
        |
        +--> RPCs publicas --> frontend React servido por ceresbi_web
```

- VPS: `178.238.235.203`, Docker Swarm single-node, rede `redeinterna`.
- Stacks observadas: `ceresbi`, `supabase`, `etl`, `traefik` e `portainer`.
- Banco do BI: Postgres do stack `supabase`, schema `mirror`. Nao e o Supabase
  Cloud identificado por `supabase/config.toml`.
- Aplicacao publica: `https://ceresbi.vouxconsultoria.com.br`; o service
  `ceresbi_web` entrega a imagem local `ceresbi:latest` por Traefik.
- Checkout de deploy na VPS: `/home/jonathan/ceresbi`, branch `main`. O antigo
  caminho `/root/ceresbi` nao existe.

## ETL ativo: Python disparado pelo host

O sincronismo atual nao e feito pelo Supabase nem pelo stack `etl` do Swarm.

1. O cron ativo `/etc/cron.d/ceres-etl-simple` roda a cada 15 minutos:
   `/opt/etl-stack/run_etl_parallel.sh`.
2. O launcher cria cinco containers efemeros com `docker run --rm`, imagem
   `etl-ceres:v15`, e aguarda todos terminarem.
3. Cada container executa `etl_campos_dealer.py --block <A-E> --once` e grava o
   resultado no schema `mirror` do Postgres self-hosted.
4. O resultado de cada ciclo vai para `/var/log/etl/etl.log`; a situacao das
   tabelas fica em `mirror.sync_control`.

Blocos: A = acoes/negocios/pedidos; B = itens de pedido/carteira/usuarios;
C = OS/funil/parque; D = empresas/produtos; E = tempo tecnico/agenda/atendimentos/ocorrencias.

### Armadilha: stack `etl` e caminho ativo sao diferentes

Os services `etl_etl-a` a `etl_etl-e` ainda aparecem no Swarm (imagem v14), mas
o agendador ativo nao os escala. Por isso, replicas `0/0` ou `0/1` nesse stack
nao constituem evidencia de que o BI esta dessincronizado. Antes de abrir um
incidente, use nesta ordem:

1. `tail -n 100 /var/log/etl/etl.log` — deve haver um ciclo recente com os cinco
   blocos `OK`.
2. `mirror.sync_control` — `status = idle` e `last_sync_at` no ciclo esperado.
   `rows_synced` e quantidade da ultima carga incremental, nao total de dados.
3. A data de negocio da tabela que importa, por exemplo `MAX(pdo_dthaprovacao)`.

Os arquivos `ceres-etl-stack.disabled`, `ceres-etl.disabled` e o caminho
`/opt/etl/` sao historicos. Nao os reative como tentativa de corrigir sincronismo.

## Acesso e seguranca operacional

- O acesso administrativo ao banco e feito via SSH na VPS e `docker exec` no
  container cujo nome corresponde a `supabase_supabase_db`.
- O MCP do Supabase e o `project_id` local nao alcançam esse banco self-hosted;
  nao tente diagnosticar producao por eles.
- Nomes/IPs de containers nao sao estaveis. Descubra o container pelo filtro
  `name=supabase_db`; nao reutilize IP de uma sessao anterior.
- Consultas de leitura sao apropriadas para diagnostico. Escalar services,
  reativar crons, aplicar SQL ou publicar exige preflight do ambiente e
  autorizacao/fluxo de deploy.

## Sinais observados nesta verificacao

Em 2026-08-02, os 15 registros de `mirror.sync_control` consultados estavam
`idle`, com atualizacoes do ciclo de aproximadamente 16:30 BRT. Isso confirma o
caminho Python/cron ativo; nao transforma uma fotografia pontual em garantia de
saude futura.

## Deriva a resolver

A funcao de producao de Acoes ja contem a regra atual de pedidos deduplicados,
negocio `Ganho` e exclusao de `REPASSE DE MAQUINA`. As migrations mais recentes
que espelham essa funcao ainda aparecem como arquivos locais nao rastreados no
checkout analisado. Elas precisam entrar no controle de versao antes de uma
proxima mudanca de regra; caso contrario, producao e repositorio podem divergir.
