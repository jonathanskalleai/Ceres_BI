# AIVOUX — Unificar CLAUDE.md

Funde o CLAUDE.md do projeto + bloco AIVOUX em UM unico arquivo no root.
Remove `.claude/CLAUDE.md` se for duplicacao do framework.

## Quando usar

- Voce instalou o AIVOUX em projeto que ja tinha CLAUDE.md proprio (VOUX, padroes
  da empresa, etc.) e quer evitar conteudo duplicado carregado em cada sessao.
- Voce ve `.claude/CLAUDE.md` e `CLAUDE.md` lado a lado e quer unificar.

## Como funciona

1. Detecta `.claude/CLAUDE.md` — se for managed pelo framework (contem "AIVOUX" ou
   "AIOX Lite", ou >100 linhas), DELETA. Se parecer conteudo proprio do usuario,
   PRESERVA e avisa.
2. Faz merge inteligente no `CLAUDE.md` raiz:
   - Se o arquivo NAO existe → cria com o bloco AIVOUX
   - Se existe SEM marcadores AIVOUX → APENDA o bloco no final, conteudo do
     projeto fica intacto
   - Se existe COM marcadores `<!-- AIVOUX-START -->...<!-- AIVOUX-END -->` →
     SUBSTITUI apenas o bloco, resto preservado

Idempotente: rodar de novo nao duplica nada.

## Acao

Execute via Bash:

```
npx @jonathanskalleai/aivoux claude-md
```

Reportar ao usuario o resultado: criado / apendado / substituido / ja correto.

Se `npx` falhar com "command not found" ou similar, sugerir:
- Confirmar que esta no diretorio raiz do projeto
- Se ainda nao instalou: `npx @jonathanskalleai/aivoux install`
- Se ja instalou versao antiga: `npx @jonathanskalleai/aivoux update` para v2.8+

NAO modificar codigo. NAO criar PR. Apenas reportar o resultado do merge.
