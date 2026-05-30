# AIVOUX - Autoridade de Agentes

## Operacoes Exclusivas

| Operacao | Agente Exclusivo |
|----------|-----------------|
| git push / push --force | @devops |
| gh pr create / merge | @devops |
| Release / tag creation | @devops |
| CI/CD pipeline config | @devops |
| Decisoes de arquitetura | @architect |
| Quality gate verdicts | @qa |
| PRD / epic creation | @pm |
| Story creation / validation | @pm |

## Delegacao

- Qualquer agente que precise de push -> delega para @devops
- @architect define tecnologia -> @data-engineer implementa schema
- @pm define requisitos -> @dev implementa -> @qa valida -> @devops publica

## Escalacao

1. Agente nao consegue completar -> reporta ao usuario
2. Quality gate falha -> retorna ao @dev com feedback especifico
3. Conflito entre agentes -> usuario decide
