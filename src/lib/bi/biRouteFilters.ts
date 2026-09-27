const ROUTES_WITHOUT_CATEGORY_FUNIL = new Set([
  "/bi/acoes",
  "/bi/comercial",
  "/bi/pedidos",
  "/bi/admin",
  "/bi/operacional",
  "/bi/produtos",
  "/bi/servicos",
  "/crm/registros",
]);

// Snapshot dashboards do not accept a temporal/vendor predicate. Hiding those
// controls is safer than displaying a filter that leaves one or more visuals
// unchanged. The page keeps its server-side snapshot/read-model contract.
const ROUTES_WITHOUT_DATE = new Set([
  "/bi/admin",
  "/bi/operacional",
  "/bi/produtos",
  // Both service tabs are current-position read models; the date control was
  // previously visible even though neither query consumed it.
  "/bi/servicos",
]);

const ROUTES_WITHOUT_VENDEDOR = new Set([
  "/bi/admin",
  "/bi/operacional",
  "/bi/produtos",
  "/bi/servicos",
]);

const ROUTES_WITHOUT_CIDADE = new Set([
  "/bi/operacional",
  "/bi/produtos",
  "/bi/servicos",
]);

/** Category/funnel controls must only appear where every visible KPI honors them. */
export function shouldHideCategoryFunil(pathname: string): boolean {
  return ROUTES_WITHOUT_CATEGORY_FUNIL.has(pathname);
}

export function shouldHideDateFilter(pathname: string): boolean {
  return ROUTES_WITHOUT_DATE.has(pathname);
}

export function shouldHideVendedorFilter(pathname: string): boolean {
  return ROUTES_WITHOUT_VENDEDOR.has(pathname);
}

export function shouldHideCidadeFilter(pathname: string): boolean {
  return ROUTES_WITHOUT_CIDADE.has(pathname);
}
