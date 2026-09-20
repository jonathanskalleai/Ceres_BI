# Hardening SSH da VPS Ceres BI — 2026-09-20

## Resultado

- Alvo confirmado: `178.238.235.203:2222` (`Ceres BI ONLINE`, Contabo).
- Criado `ceres-admin`, autenticado somente por chave e com `sudo` total.
- Login SSH remoto de `root`, senha e keyboard-interactive desabilitados.
- Limites ativos: `LoginGraceTime 20`, `MaxAuthTries 3`,
  `MaxStartups 10:30:30` e `PerSourceMaxStartups 3`.
- Fail2ban ativo no `sshd`: 3 falhas em 10 minutos, ban de 1 hora.
- Acesso de emergencia: Rescue/console da Contabo; alias IPv6 local
  `ceres-prod-v6` evita depender do IPv4 durante um ban administrativo.

## Validacao runtime

- `ssh ceres-prod` e `ssh ceres-prod-v6`: PASS como `ceres-admin`.
- `sudo -n id -u`: `0` nas duas rotas.
- `sshd -t`: PASS; serviços `ssh`, `fail2ban` e `docker`: ativos.
- Politica efetiva: `PermitRootLogin no`, `PasswordAuthentication no`,
  `AuthenticationMethods publickey`.
- Web e `/api/ai/health`: HTTP 200 após o reload do SSH.

## ETL

O `etl_etl-d` exibido como `0/1` no Swarm é um job legado concluído. O caminho
ativo é `/etc/cron.d/ceres-etl-sequential`, executando a imagem `etl-ceres:v21`.
Os blocos A-E concluíram com sucesso a cada 15 minutos durante a validação.

## Deploy e smoke do mapa

- Deploy produtivo concluído no SHA `edaad1707bf60a3fe6dddbc7380a8e4d7ee9a6e7`.
- Serviços `ceresbi_web` e `ceresbi_ai` executando imagens desse SHA.
- Web pública e `/api/ai/health`: HTTP 200.
- CSP pública permite `https://*.tile.openstreetmap.org` em `img-src`.
- Tile do OpenStreetMap respondeu HTTP 200.
- Smoke visual autenticado em `/bi/acoes`: mapa renderizado com fundo do
  OpenStreetMap, controles do Leaflet e dados do período (50 pinos para 57 de
  76 oportunidades). Nenhum estado de erro foi exibido no painel.

## Incidente durante a validacao

Um teste negativo de root completou o limite do Fail2ban e baniu temporariamente
o IPv4 administrativo. A recuperação foi feita pela mesma chave no IPv6, sem
reabrir root ou senha. Por isso testes futuros devem consultar `sudo sshd -T`,
em vez de repetir tentativas de autenticação que devem falhar.

## Pendencia de seguranca

Há credencial histórica em texto claro em documentação antiga do repositório.
Ela não foi removida porque as regras do projeto exigem confirmação explícita
para apagar conteúdo. A autenticação por senha e a senha local de root estão
bloqueadas, mas a documentação ainda deve ser saneada em demanda autorizada.
