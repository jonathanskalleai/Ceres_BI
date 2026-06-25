# Handoff — ETL Ceres BI

**Data:** 2026-06-22
**Status:** BLOQUEADO — views não existem no banco CamposDealer_BI

## Resumo da Sessão

| Etapa | Status |
|-------|--------|
| pymssql instalado + funcionando | ✅ |
| Connector reescrito | ✅ |
| Docker image construída | ✅ |
| Conexão com SQL Server | ✅ Login OK |
| Acesso ao banco CamposDealer_BI | ✅ |
| Views VW_Ceres_* existentes | ❌ **Banco vazio** |

## Problema Atual

O banco `CamposDealer_BI` está **completamente vazio**:
- Sem tabelas
- Sem views

```
=== DATABASES ===
CamposDealer_BI  ← vazio
master
tempdb
```

### Views que o ETL precisa (fornecidas pelo usuário):

```
VW_Ceres_Empresas
VW_Ceres_Usuario
VW_Ceres_UsuarioXEmpresa
VW_Ceres_CRM_Acoes
VW_Ceres_CRM_CarteiraClientes
VW_Ceres_CRM_ClienteContatos
VW_Ceres_CRM_ClienteParqueMaquinas
VW_Ceres_CRM_ClientePropriedade
VW_Ceres_CRM_Negocios
VW_Ceres_CRM_Negocios_Etapas
VW_Ceres_CRM_FunilEtapa
VW_Ceres_CRM_Pedidos
VW_Ceres_CRM_PedidosItem
VW_Ceres_CRM_PedidosUsado
VW_Ceres_CRM_EstoqueVirtual
VW_Ceres_CRM_TAGXACAO
VW_Ceres_CRM_TAGXCLIENTE
VW_Ceres_CRM_TAGXNEGOCIO
VW_Ceres_CRM_TAGXPEDIDO
VW_Ceres_Produtos
VW_Ceres_ProdutosGrupo
VW_Ceres_ProdutosMarca
VW_Ceres_ProdutosModelo
VW_Ceres_Agenda
VW_Ceres_OrdemServico
VW_Ceres_Ocorrencias
VW_Ceres_AtendimentoOS
VW_Ceres_AtividadeExtra
VW_Ceres_TecnicoTempo
```

## Questões em Aberto

1. **As views precisam ser criadas?** Se sim, você tem os scripts CREATE VIEW?
2. **As views estão em outro banco?** (não encontramos em nenhum)
3. **A integração anterior usava credenciais diferentes?**
4. **O pessoal da HF Sistemas precisa criar as views?**

## Arquivos no Projeto

| Arquivo | Descrição |
|---------|-----------|
| `/opt/etl-docker/` | Código ETL Python |
| `/opt/etl-docker/connectors/sqlserver.py` | Connector pymssql (pronto) |
| `/opt/etl-docker/config/config.yaml` | Config com credenciais |
| `supabase/functions/sync-campus-dealer/index.ts` | Edge Function que funcionava |

## Config Atual

```yaml
sqlserver:
  server: "wfrsistemas.net.br"
  port: 1433
  database: "CamposDealer_BI"
  username: "usrBI_CresCandiotto"
  password: "#c3r#$B1Cd27"

postgres:
  host: "10.0.1.220"
  port: 5432
  database: "postgres"
  username: "supabase_admin"
  password: "3920da348575d663915a01787b01266c"
```

## Próximos Passos

1. Verificar com HF Sistemas se as views foram criadas
2. Se não foram, criar scripts CREATE VIEW baseados em:
   - `supabase/functions/sync-campus-dealer/index.ts` (mapeamento de colunas)
   - `docs/analise-views/inventario-colunas.md` (estrutura)
3. Testar ETL após views existirem

## Como Continuar

```bash
ssh root@178.238.235.203
docker run --rm --network container:supabase_supabase_db.1.m8y6f3d5q3r31f060kq74ncfm \
  -v /var/log/etl:/var/log/etl ceres-etl:latest --all --once
```
