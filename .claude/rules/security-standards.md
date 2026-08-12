# AIVOUX - 10 Security Standards

Esta e a checklist mestre de seguranca do AIVOUX. **Toda implementacao DEVE
respeitar estas 10 praticas** quando aplicavel ao escopo. Funciona em conjunto
com as `coding-standards.md` (12 best practices), nao as substitui.

## Filosofia: Security Application Matrix

Diferente das 12 coding practices (sempre aplicaveis), seguranca e **situacional**.
Aplique conforme o escopo:

| Escopo | Praticas que aplicam |
|--------|----------------------|
| **TODA sessao** | #1 Secrets, #9 Dependencies |
| **Backend / API / DB** | #3, #4, #5, #6, #7 |
| **Frontend** | #2, #3, #5 |
| **Deploy / Infra** | #1, #8, #9, #10 |
| **Auth / User Management** | #4, #6, #7 |

---

## Enforcement via @security (agente dedicado)

Estes 10 standards tem DOIS niveis de aplicacao:

1. **Raso, sempre (@qa check #4):** em qualquer pipeline, o @qa passa os standards
   aplicaveis ao escopo como uma das 8 verificacoes. Rede de baixo custo.
2. **Profundo, condicional (@security gate):** quando a mudanca toca **superficie
   sensivel** (auth, autorizacao/RLS, entrada externa, dados sensiveis, upload,
   infra exposta), o router insere o `@security` no pipeline APOS o `@reviewer` e
   ANTES do `@qa`. Ele faz threat modeling (STRIDE leve) + auditoria profunda +
   ferramentas (`secret-scan.sh`, `npm audit`), e emite verdict `SECURE /
   CONCERNS / VULNERABLE`. `VULNERABLE` (CRITICAL/HIGH) volta ao @dev. Quando o
   @security roda, ELE e a autoridade — o @qa referencia o verdict, nao reaudita.

Alem do gate de construcao, o `/aivoux/audit-security` usa o `@security` como
executor para auditar um sistema EXISTENTE (read-only) e produzir relatorio de
postura + backlog em `docs/security/`. Espelha o `/aivoux/discover`.

**Regra do segredo (HARD, vale para @security, @qa e a auditoria):** ao achar
credencial, reportar PATH + linha + TIPO, JAMAIS o valor. O relatorio de
seguranca nunca pode conter o proprio segredo que ele denuncia.

**Escopo defensivo:** o @security protege a aplicacao do usuario (encontrar e
fechar buracos). Nao faz exploracao ativa de terceiros nem gera payload
ofensivo. Auditar/proteger o proprio sistema e sempre legitimo.

Config em `.aivoux/config.yaml` bloco `security_gate` (keywords sensiveis,
`sensitive_paths` coroa, `block_on_vulnerable`).

---

## 1. Secret Management & Sensitive Data Protection

**Principio:** Credenciais NUNCA em codigo-fonte. Sempre via env vars + .gitignore.

**Aplicar:**
- Verificar que `.gitignore` contem: `.env`, `.env.local`, `.env.*.local`, `*.pem`, `*.key`, `secrets/`
- API keys, passwords, tokens, OAuth secrets em variaveis de ambiente
- Usar `process.env.VARIAVEL` (Node) ou equivalente — nunca hardcoded
- `.env.example` versionado com chaves vazias para documentar
- Em frontend (Next.js/Vite): usar `NEXT_PUBLIC_*` / `VITE_*` apenas para o que pode ser publico
- Secret manager (Vercel/Supabase secrets, AWS SM) para producao

**Owner:** `@dev` (codigo) + `@devops` (infra)
**Validator:** `@qa` + pre-commit hook

**Anti-padrao:** `const apiKey = "sk-1234567890abcdef"` no codigo.

---

## 2. Frontend NAO Expor APIs Sensiveis

**Principio:** Codigo cliente e publico. Toda chave/endpoint sensivel fica no backend.

**Aplicar:**
- API keys de servicos pagos (OpenAI, Stripe secret, Twilio) **NUNCA** no frontend
- Endpoints internos (admin, batch, debug) atras de auth + nao expostos via CORS aberto
- Service role keys (Supabase) **JAMAIS** no client — apenas anon key
- Chamadas sensiveis via Server Actions, API Routes, Edge Functions, ou backend dedicado
- Verificar com DevTools Network: nenhuma request expoe header com secret

**Owner:** `@architect` (design) + `@dev` (impl)
**Validator:** `@qa`

**Anti-padrao:** `fetch('https://api.openai.com', { headers: { 'Authorization': 'Bearer sk-...' } })` no React.

---

## 3. Input Validation & Sanitization

**Principio:** Nunca confiar em input do cliente. Validar tipo, formato, tamanho.

**Aplicar:**
- Schemas com Zod / Yup / Joi para validar payloads de API
- Validacao de tipo + range em todos os params (path, query, body)
- Tamanho maximo em strings (evitar payloads gigantes / DoS)
- Sanitizar HTML user-generated antes de renderizar (DOMPurify)
- Validar tipos de arquivo + tamanho em uploads
- Reject early, fail loud — retornar 400 com mensagem util

**Owner:** `@dev`
**Validator:** `@qa`

**Anti-padrao:** `app.post('/user', (req, res) => db.insert(req.body))` sem schema.

---

## 4. Authentication & Authorization (Least Privilege)

**Principio:** Toda rota sensivel autenticada. Cada user ve apenas o que pode.

**Aplicar:**
- Middleware de auth em todas as rotas protegidas (nao opt-in, opt-out)
- RLS (Row Level Security) habilitado em TODAS as tabelas Supabase (gate `@data-engineer`)
- Roles/permissions verificadas no servidor — nunca confiar em flag client-side
- JWTs com expiracao curta (1h max) + refresh token rotation
- Logout invalida sessao no servidor (nao apenas limpa client)
- Rate limiting em endpoints de auth (login, password reset)

**Owner:** `@architect` + `@dev` + `@data-engineer` (RLS)
**Validator:** `@qa`

**Anti-padrao:** `if (user.isAdmin)` checado apenas no React, sem revalidar no backend.

---

## 5. Common Attacks Protection (SQL Inj / XSS / CSRF)

**Principio:** Os 3 vetores classicos. Cada um tem defesa especifica.

**Aplicar:**
- **SQL Injection:** ORM/query builder (Prisma, Drizzle, Supabase client) ou parameterized queries. NUNCA template literal com input
- **XSS:** React/Vue ja escapam por default; cuidado com `dangerouslySetInnerHTML` / `v-html` — sempre passar por DOMPurify
- **CSRF:** SameSite=Strict cookies + CSRF tokens em forms tradicionais; APIs JWT com Authorization header sao imunes naturalmente
- Content Security Policy (CSP) header configurado
- Cookies sensiveis: `HttpOnly`, `Secure`, `SameSite=Strict`

**Owner:** `@dev`
**Validator:** `@qa` + CodeRabbit (pega muitos casos)

**Anti-padrao:** `db.query(\`SELECT * FROM users WHERE id = ${userId}\`)`.

---

## 6. Secure Logging (No PII / No Secrets)

**Principio:** Logs ajudam debug, mas vazam tudo se mal feitos.

**Aplicar:**
- **NUNCA** logar: senhas, tokens, chaves, CPFs, dados de cartao, headers de Authorization
- Logar: timestamps, user IDs (nao emails), action types, status codes, request IDs
- Eventos criticos com logging estruturado: login (success/fail), password reset, role change, data export
- Retencao definida (ex: 90 dias) e rotacao de logs
- Nao expor stack traces em error messages do cliente — log no servidor, retornar erro generico
- Mascarar PII em logs quando inevitavel: `user@***.com` em vez de email completo

**Owner:** `@dev`
**Validator:** `@qa`

**Anti-padrao:** `console.log('Login attempt', { email, password })`.

---

## 7. Password Policy & Hashing

**Principio:** Senhas em plain text = breach catastrofico. Hash com sal unico.

**Aplicar:**
- **Hashing:** bcrypt (cost >=12) ou Argon2id — NUNCA md5/sha1/sha256 puros
- Salt unico por usuario (bcrypt/argon2 fazem automatico)
- Politica minima: 12 caracteres, mix de tipos, validar contra lista de senhas comuns (zxcvbn lib)
- Reset password: token unico, expiracao curta (15-30min), 1-uso, enviado por email separado da app
- Rate limit em login (max 5 tentativas / 15min) + lockout temporario
- 2FA opcional (TOTP) para contas sensiveis
- Em Supabase: usar Auth nativo (ja faz tudo isso) — nao reimplementar

**Owner:** `@dev`
**Validator:** `@qa`

**Anti-padrao:** `password === user.password` ou `md5(password)`.

---

## 8. Backup & Recovery

**Principio:** Disaster sempre acontece. Plano de recovery testado vale ouro.

**Aplicar:**
- Backup automatico do DB diario (Supabase ja faz no plano Pro+)
- Retencao de pelo menos 7 dias diario + 30 dias semanal
- Backup off-site (regiao diferente) para DR critico
- **Testar restore periodicamente** — backup que nao restaura nao existe
- Documentar RTO (Recovery Time Objective) e RPO (Recovery Point Objective)
- Backup de arquivos de usuario (uploads, attachments) — nao so DB
- Migrations versionadas (rollback documentado)

**Owner:** `@devops`
**Validator:** `@architect` (review de DR plan)

**Anti-padrao:** "Confiamos no provider" sem nunca ter testado restore.

---

## 9. Dependency Security

**Principio:** Codigo de terceiros e a maior superficie de ataque.

**Aplicar:**
- `npm audit` no CI — bloquear PR com HIGH/CRITICAL nao resolvidos
- Dependabot / Renovate ativo no repo (PRs automaticos de patches)
- Lockfile commitado (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`)
- Auditoria periodica (mensal) de deps nao usadas — remover
- Antes de adicionar nova dep: verificar maintenance status, downloads/semana, last commit
- Evitar deps com >1000 transitivas para tasks simples (left-pad lesson)
- Codigo de exemplo / demo / test removido antes de producao

**Owner:** `@devops` (CI gate) + `@dev` (escolha de deps)
**Validator:** Quality gate `npm audit`

**Anti-padrao:** Adicionar lib obscura para 1 funcao trivial; ignorar `npm audit` reports.

---

## 10. HTTPS & Security Headers

**Principio:** Comunicacao em claro = man-in-the-middle. Headers protegem o navegador.

**Aplicar:**
- HTTPS obrigatorio em producao (Vercel/Netlify ja fornecem; cert auto-renew)
- Redirect 301 de HTTP → HTTPS no servidor
- **HSTS** header: `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- **CSP** (Content-Security-Policy) restrito — minimo `default-src 'self'`
- **X-Frame-Options:** `DENY` ou `SAMEORIGIN` (anti-clickjacking)
- **X-Content-Type-Options:** `nosniff`
- **Referrer-Policy:** `strict-origin-when-cross-origin`
- **Permissions-Policy:** desabilitar features nao usadas (camera, geolocation, etc)
- Sem mixed content: nenhum `<script src="http://...">` em pagina HTTPS
- Cookies sensiveis com flag `Secure`

**Owner:** `@devops`
**Validator:** `@qa` (testar com securityheaders.com / Mozilla Observatory)

**Anti-padrao:** Site HTTPS carregando `<img src="http://cdn-antigo.com/logo.png">`.

---

## Como Esta Checklist e Aplicada

### `@dev` (durante implementacao)

Antes de marcar tarefa como completa, validar conforme escopo (matrix no topo):
- [ ] #1 Secrets: nenhum hardcoded, .env no gitignore
- [ ] #2 Frontend exposure: nenhuma key/endpoint sensivel exposto
- [ ] #3 Input validation: schemas em toda entrada externa
- [ ] #4 Auth: middleware nas rotas protegidas, RLS habilitado
- [ ] #5 Common attacks: ORM/sanitize/CSP no lugar
- [ ] #6 Logging: sem PII/secrets, eventos criticos cobertos
- [ ] #7 Passwords: bcrypt/argon2, policy + rate limit
- [ ] #8 Backup: N/A (responsabilidade @devops)
- [ ] #9 Deps: `npm audit` clean, sem libs nao usadas
- [ ] #10 Headers: N/A (responsabilidade @devops)

### `@qa` (durante review)

Check #4 do quality gate (Security) audita os 10 pontos sistematicamente.
Verdict FAIL para qualquer violacao CRITICA:
- Secret hardcoded
- API key sensivel no frontend
- SQL injection vulneravel
- Senha em plain text
- Endpoint admin sem auth

### `@architect` (durante design)

Considerar #2, #4, #8 ao desenhar:
- Onde ficam os secrets?
- Estrategia de auth + RLS?
- Plano de backup/DR coerente com criticidade dos dados?

### `@devops` (durante deploy)

Owner direto de #1 (infra), #8, #9, #10. Antes de cada deploy:
- [ ] Variaveis de ambiente configuradas no provider
- [ ] HTTPS ativo + cert valido
- [ ] Headers de seguranca configurados
- [ ] `npm audit` clean
- [ ] Backup configurado e testado

### `@data-engineer` (durante schema design)

Owner direto de RLS (parte de #4):
- [ ] RLS habilitado em TODAS as tabelas
- [ ] Policies testadas com `select` em diferentes roles
- [ ] Service role usado APENAS em backend, nunca no client

---

## Quality Gates de Seguranca

Adicionados aos quality gates em `shared-config.md`:

```
6. npm audit --audit-level=high → 0 issues HIGH/CRITICAL
7. Pre-commit secret scan → 0 matches
```

---

## Referencias Externas

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Mozilla Observatory](https://observatory.mozilla.org/)
- [Security Headers](https://securityheaders.com/)
- [npm audit docs](https://docs.npmjs.com/cli/v10/commands/npm-audit)
