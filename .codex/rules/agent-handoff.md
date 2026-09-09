# AIVOUX — Agent Handoff Protocol

Reduz tokens ao trocar de agente. Em vez de manter a persona inteira do agente
anterior no contexto, gera um artefato compacto com o essencial (~300 tokens).

## Quando Ativar

Toda vez que um novo agente e invocado e a sessao ja tem outro agente ativo.

## Ao Sair de um Agente (`*exit`)

Antes de desativar, gerar e salvar em `.aivoux/handoffs/latest.yaml`:

```yaml
handoff:
  from_agent: "{id do agente atual}"
  to_agent: "{id do proximo agente, se conhecido}"
  timestamp: "{ISO-8601 UTC}"
  story_id: "{story ativa, se houver — null se nao houver}"
  branch: "{branch git atual}"
  decisions:
    - "{decisao chave 1}"
    - "{decisao chave 2}"
  files_modified:
    - "{arquivo 1}"
    - "{arquivo 2}"
  next_action: "{o que o proximo agente deve fazer}"
  consumed: false
```

Limites: max 5 decisions, max 10 files_modified, max 500 tokens total.

## Ao Ativar um Agente

1. Verificar se `.aivoux/handoffs/latest.yaml` existe e `consumed != true`.
2. Se existir: apresentar ao usuario como `📋 Contexto de @{from_agent}:` com decisions, arquivos e next_action.
3. Marcar `consumed: true` no arquivo apos apresentar.
4. Descartar a persona completa do agente anterior — o artefato e suficiente.

## O que Preservar no Artefato (SEMPRE)

- Story ativa (ID)
- Branch git atual
- Decisoes tecnicas tomadas na sessao
- Arquivos criados ou modificados
- Proxima acao sugerida

## O que Descartar (NUNCA carregar do agente anterior)

- Persona completa do agente anterior
- Lista de comandos do agente anterior
- Configuracoes especificas do agente anterior

## Economia Estimada por Troca

| Trocas na sessao | Sem protocolo | Com protocolo | Economia |
|---|---|---|---|
| 1 troca | ~5K tokens | ~2.7K tokens | ~46% |
| 2 trocas | ~8K tokens | ~3.1K tokens | ~61% |
| 3 trocas | ~12K tokens | ~3.5K tokens | ~71% |
