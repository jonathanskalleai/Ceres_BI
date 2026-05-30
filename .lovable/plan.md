

## Plano: Exibir data/hora da última atualização no Dashboard

### Abordagem

Buscar o `MAX(created_at)` da tabela `registros_comerciais` via query ao Supabase e exibir no sidebar, abaixo do título "Painel Comercial".

### Alterações

**1. `src/hooks/useComercialData.ts`**
- Adicionar query `SELECT MAX(created_at) FROM registros_comerciais` durante o fetch
- Retornar `lastUpdated: string | null` no hook junto com `data`, `isLoading`, `error`

**2. `src/pages/Dashboard.tsx`**
- Extrair `lastUpdated` do hook `useComercialData`
- Passar como prop para `DashboardSidebar`

**3. `src/components/dashboard/DashboardSidebar.tsx`**
- Aceitar prop `lastUpdated?: string | null`
- Exibir abaixo de "Painel Comercial":
  - `"Última atualização: 23/03/2026 às 14:35"`
  - Estilo: `text-[10px] text-sidebar-foreground/50`
- Formatar com `toLocaleDateString('pt-BR')` e `toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })`

### Detalhes Técnicos

A query usa RPC-free approach: `supabase.from('registros_comerciais').select('created_at').order('created_at', { ascending: false }).limit(1)` para obter o registro mais recente sem precisar de função SQL customizada.

