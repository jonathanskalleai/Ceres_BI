---
feature: admin-permissions
updated_at: 2026-09-21T13:44:34Z
updated_by: "scribe (Codex)"
status: active
---

# Admin — Controle de Visibilidade de Modulos

**Proposito:** Permitir ocultar modulos da sidebar sem bloquear o acesso a rota.

## Entry Points
- `src/pages/admin/AdminUsers.tsx` — lista administrativa de usuários
- `src/services/adminService.ts` — perfis, permissões e e-mails administrativos
- `src/components/admin/UserPermissionsSheet.tsx` — modal de permissoes com toggle de visibilidade
- `src/components/layout/AppSidebar.tsx` — usa `visibleModules` para renderizar
- `src/hooks/usePermissions.ts` — exporta `visibleModules` e `canAccess`

## E-mails dos Usuários

`admin_get_user_emails(uuid[])` lê `auth.users` em lote. A função é
`SECURITY DEFINER`, usa `search_path` vazio e só aceita sessão de administrador
ativo. `anon` e `PUBLIC` não possuem `EXECUTE`; a service role nunca entra no
bundle web. A UI mostra o e-mail ou “E-mail não cadastrado”, nunca o UUID.

## Modelo de Dados

### Tabela: user_permissions
```sql
ALTER TABLE user_permissions ADD COLUMN is_visible boolean DEFAULT true;
```

**Semantica:**
- Se modulo NAO esta em `user_permissions` → visivel
- Se modulo ESTA com `is_visible = true` → visivel
- Se modulo ESTA com `is_visible = false` → oculto na sidebar, MAS rota continua acessivel

## Arquitetura de Seguranca (apos Codex adversarial review)

### Acesso vs Visibilidade
- `canAccess(moduleId)` — verifica existencia do registro em `user_permissions`
- `visibleModules` — filtra modulos onde `is_visible !== false`
- Ocultar NAO bloqueia acesso (ModuleGuard so verifica `canAccess`)

### Protecao contra Escalonamento
`UserPermissionsSheet` carrega registros COMPLETOS via `getUserPermissions`:
```typescript
const hasAccess = (moduleId) => rec !== undefined; // existencia do registro
const isVisible = (moduleId) => rec?.is_visible !== false; // campo is_visible
```

**NO SAVE:** apenas modulos com `hasAccess === true` sao enviados.

## RPC Transacional
```sql
-- supabase/migrations/20260804_set_user_permissions_transactional.sql
CREATE OR REPLACE FUNCTION set_user_permissions_tx(
  p_user_id uuid,
  p_permissions jsonb
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  lock_key bigint;
BEGIN
  lock_key := ('x' || substr(p_user_id::text, 1, 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(lock_key);
  
  DELETE FROM user_permissions WHERE user_id = p_user_id;
  
  INSERT INTO user_permissions (user_id, module_id, is_visible)
  SELECT p_user_id, (e->>'module_id')::uuid, 
         COALESCE((e->>'is_visible')::boolean, true)
  FROM jsonb_array_elements(p_permissions) AS e;
END;
$$;
```

**Nota:** Fallback inseguro (DELETE+INSERT separado) foi REMOVIDO.

## Como Alterar com Seguranca
1. `canAccess()` NAO deve verificar `is_visible` — isso quebraria a semantica
2. `visibleModules` filtra por `is_visible !== false`
3. Qualquer nova funcao de permissao deve ser transacional
4. Testar: abrir usuario restrito, salvar sem alteracoes — nenhum modulo deve ser concedido

## Smoke
- `npm run build` — sucesso
- `npx vitest run src/services/__tests__/adminService.test.ts src/components/admin/UserRow.test.tsx` — e-mail exibido e UUID oculto
- Admin autenticado abre `/admin/users`: cada linha mostra o e-mail correspondente
- Chamada sem admin a `admin_get_user_emails` → erro `42501`
- Usuario restrito abre PermissionsSheet, clica Salvar sem alteracoes: nenhum modulo e concedido
- Modulo oculto na sidebar: URL direta continua acessivel
- Modulo visivel na sidebar: toggle em PermissionsSheet reflete estado atual
