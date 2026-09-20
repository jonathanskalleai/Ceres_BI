import { describe, expect, it } from "vitest";
import { shouldHideCategoryFunil } from "@/lib/bi/biRouteFilters";

describe("shouldHideCategoryFunil", () => {
  it.each(["/bi/acoes", "/bi/comercial", "/crm/registros"])(
    "hides misleading controls on %s",
    (pathname) => expect(shouldHideCategoryFunil(pathname)).toBe(true),
  );

  it.each(["/bi/painel", "/bi/inteligencia", "/bi/pedidos"])(
    "keeps filters on routes that consume them: %s",
    (pathname) => expect(shouldHideCategoryFunil(pathname)).toBe(false),
  );
});
