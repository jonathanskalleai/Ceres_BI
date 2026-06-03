/**
 * Feature flags para migracao incremental do frontend
 * de edge function (query-sqlserver) para Supabase PostgREST (schema mirror).
 *
 * Quando `true`, o service correspondente le direto do PostgREST.
 * Quando `false`, usa o fallback legado (edge function).
 */
export const USE_MIRROR: Record<string, boolean> = {
  crm_negocios: true,
  crm_pedidos: true,
  crm_pedidos_item: true,
  crm_carteira_clientes: true,
  crm_acoes: true,
  crm_funil_etapa: true,
  usuarios: true,
  ordens_servico: true,
  cliente_parque_maquinas: true,
};
