# AIVOUX — Pendências de desenvolvimento

O modo `development` cria aqui um registro compacto para cada demanda que
alterou código ou schema sem passar pelos gates `reviewer`, `security` e `qa`.

Cada registro deve conter apenas metadados: resumo curto da demanda, categoria,
agentes, arquivos, SHAs de referência e status. Nunca copie prompts completos,
segredos ou dados sensíveis para esta pasta.

Status usados pelo framework:

- `PENDING_REVIEW` — aguardando auditoria posterior.
- `NEEDS_FIX` — auditoria encontrou pendências.
- `APPROVED` — reviewer/segurança condicional/QA concluíram com sucesso.

Para auditar: `/aivoux/audit pending` (ou o equivalente do harness). O fluxo
full atualiza o status do registro e preserva o histórico do arquivo.
