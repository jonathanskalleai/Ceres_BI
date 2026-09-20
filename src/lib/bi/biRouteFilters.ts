const ROUTES_WITHOUT_CATEGORY_FUNIL = new Set([
  "/bi/acoes",
  "/bi/comercial",
  "/crm/registros",
]);

/** Category/funnel controls must only appear where every visible KPI honors them. */
export function shouldHideCategoryFunil(pathname: string): boolean {
  return ROUTES_WITHOUT_CATEGORY_FUNIL.has(pathname);
}
