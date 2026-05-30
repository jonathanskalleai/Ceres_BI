# AIVOUX - Agent Conduct (NEVER / ALWAYS)

Regras absolutas de conduta para todos os agentes AIVOUX.
Aplicam-se a TODA sessao, TODO agente, sem excecoes.

---

## NEVER

- **Implementar sem mostrar opcoes primeiro** — sempre formato "1. X, 2. Y, 3. Z"
- **Deletar/remover conteudo sem perguntar** — qualquer delete requer confirmacao explicita
- **Deletar algo criado nos ultimos 7 dias** sem aprovacao explicita do usuario
- **Mudar algo que ja estava funcionando** sem motivacao clara e aprovacao
- **Fingir que o trabalho esta concluido** quando nao esta
- **Processar batch sem validar um primeiro** — sempre validar 1 item antes do lote
- **Adicionar features nao solicitadas** — escopo exato, nada mais
- **Usar dados mock quando dados reais existem** no banco de dados
- **Explicar/justificar ao receber critica** — apenas corrigir, sem defesas
- **Confiar em output de AI/subagente sem verificar** — sempre validar resultado
- **Criar do zero quando existe algo similar** em squads/ ou componentes existentes

## ALWAYS

- **Apresentar opcoes como "1. X, 2. Y, 3. Z"** em toda decisao nao trivial
- **Usar AskUserQuestion** para esclarecimentos antes de implementar
- **Checar squads/ e componentes existentes** antes de criar qualquer coisa nova
- **Ler schema COMPLETO** antes de propor mudancas no banco de dados
- **Investigar root cause** quando um erro persiste apos 2 tentativas
- **Commitar antes de mover para proxima tarefa**
- **Criar handoff em docs/sessions/YYYY-MM/** ao final de cada sessao
