# Operação de deploy do Ceres BI

O diretório de produção precisa ser um checkout Git limpo com um `.env` local e
não versionado. O deploy não usa `:latest`: ele constrói `ceresbi:<SHA>` e
`ceresbi-ai:<SHA>` a partir do mesmo commit e grava essas tags no Swarm.

## Variáveis locais obrigatórias

Além das `VITE_*` já usadas na compilação do front, o `.env` da VPS deve ter:

```dotenv
DEPLOY_BRANCH=release/bi-consolidacao-fase-1
CERESBI_AI_OPENROUTER_API_KEY=<chave do provedor>
CERESBI_AI_DATABASE_URL=<url interna do PostgreSQL>
CERESBI_AI_JOB_TOKEN=<token aleatório longo>
```

`CERESBI_AI_JOB_TOKEN` autentica apenas os endpoints de geração semanal. Não o
coloque em commits, logs ou comandos de terminal que possam aparecer na lista
de processos.

## Publicação

No checkout da VPS, execute `bash deploy.sh`. O script recusa diretório sem
Git, alterações rastreadas, segredos ausentes ou serviços com imagem diferente
do SHA construído. Ao final, ele verifica a página pública e a saúde do serviço
de IA.

Atenção ao ler a saída: o smoke do `/api/ai/health` pode responder `404` nas
primeiras tentativas enquanto o Traefik troca de backend, e o script imprime
`Done` na mesma saída onde esses `404` apareceram. `Done` com `404` acima não é
falha, mas também não é evidência — confirme o estado final por fora
(`docker service ls` com a tag do SHA + `curl` nos endpoints).

Os security headers e a CSP ficam em `nginx.conf`, dentro da imagem web: mudar
CSP exige passar por este deploy (rebuild), não por reload de nginx na VPS.
Se a alteração afetar `img-src`, `script-src` ou `connect-src`, faça smoke dos
recursos externos da tela — CSP falha em silêncio, sem exception e sem log.

## Agenda semanal

Instale a linha abaixo no crontab do usuário que opera Docker, ajustando o
caminho do checkout. Ela roda no sábado às 03:10 de São Paulo e evita execução
concorrente. O script lê o token do `.env` sem expô-lo na lista de processos.

```cron
CRON_TZ=America/Sao_Paulo
10 3 * * 6 /caminho/do/checkout/scripts/run-ai-weekly-signals.sh >> /var/log/ceresbi-ai-weekly.log 2>&1
```

O job estruturado reprocessa 14 dias para absorver atualizações tardias, mas
não duplica classificações nem agregados. Para a carga inicial, execute uma vez
o endpoint protegido com janela de 90 dias e `max_records=4000`.
