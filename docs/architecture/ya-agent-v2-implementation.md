# Arquitetura de implementação — Agente Analítico Conversacional v2

**Data:** 08/09/2026

**Escopo:** Equipe, Ações e Desempenho de Vendas
**Modo:** DEVELOPMENT; a v2 permanece atrás de feature flag

## Decisões

- O chat existente em `ai-service/ya_chat.py` continua disponível para rollback.
- A v2 será uma rota aditiva (`/ai/v2/chat/stream`) protegida por JWT e `bi.ya`.
- O servidor entrega ao provedor uma lista real de tools OpenAI-compatible e
  executa um loop limitado; não haverá simulação de tool calling por regex.
- Cada tool retorna dados sanitizados, evidência, escopo aplicado, linhagem,
  frescura, avisos e artefatos. SQL, credenciais e PII não entram na resposta.
- A conexão analítica e a conexão de estado possuem adaptadores distintos,
  mesmo quando apontam para o mesmo `DATABASE_URL` durante o desenvolvimento.
- Assinaturas de RPC são descobertas em runtime por `pg_proc`; migrations locais
  documentam contratos, mas não são tratadas como prova de instalação.
- SQL exploratório passa por defesa lexical e parse estrutural PostgreSQL via
  `sqlglot`; ausência do parser bloqueia a exploração em vez de degradar
  silenciosamente.
- A memória da thread usa estado por tópico; memória duradoura usa `user_id` e
  só é gravada após declaração/confirmação explícita do usuário.
- O resultado factual é verificado contra as evidências produzidas no turno.

## Fluxo

```text
JWT + pergunta + contexto da tela
        -> contexto da thread/usuário
        -> LLM com 10 contratos de tools
        -> executor validado e read-only
        -> evidências/artefatos sanitizados
        -> LLM pode continuar ou concluir
        -> verificador factual + persistência + SSE
```

## Limites iniciais

- 6 rodadas de modelo, 8 tool calls e 90 segundos por turno.
- No máximo 2 consultas exploratórias por turno.
- Resultados exploratórios: até 100 linhas, 24 colunas e 60.000 caracteres.
- Artefatos visuais são dados estruturados validados pelo backend; a UI nunca
  interpreta HTML ou código produzido pelo modelo.

## Matriz semântica inicial

| Métrica | Regra | Competência | Grão | Fonte | Estado |
|---|---|---|---|---|---|
| Vendas | Pedido aprovado ligado a negócio Ganho, sem Repasse | Aprovação do pedido | Pedido único | RPC de desempenho vigente | Pendente de assinatura viva |
| Faturamento | Soma do valor das vendas padrão | Aprovação do pedido | Pedido único | RPC de desempenho vigente | Pendente de assinatura viva |
| Ticket médio | Faturamento / pedidos únicos | Aprovação do pedido | Período | Backend da tool | Pendente de conciliação viva |
| Perdas | Negócio canônico Perdido, sem Repasse | Fechamento | Negócio por número | RPC de desempenho vigente | Pendente de assinatura viva |
| Ações | Ações concluídas no recorte | Conclusão da ação | Ação | RPCs de Ações vigentes | Pendente de assinatura viva |
| Visitas | Ações concluídas classificadas como visita | Conclusão da ação | Ação | RPCs de Ações vigentes | Pendente de assinatura viva |
| Equipe | Agregados consultor-mês conforme RPC instalada | Conforme indicador | Consultor-mês | `rpc_equipe_desempenho_mensal_v2` | Pendente de assinatura viva |
| Equipamentos vendidos | Itens de pedidos padrão deduplicados | Aprovação do pedido | Pedido-item | A validar no mirror vivo | Bloqueado até conciliação |

## Runtime conhecido

O Postgres local disponível nesta sessão é `vouxbi_ixc` (PostgreSQL 16.14) e não
possui schema `mirror`, tabelas `ya_*` ou as RPCs do BI. A implementação deve
falhar fechada para a v2 quando a fonte/configuração não estiver disponível.
Validação autenticada contra o banco do BI, o provedor Llama e os dashboards
fica para preview autorizado.
