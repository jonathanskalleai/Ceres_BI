import { describe, expect, it } from "vitest";
import {
  shouldHideCategoryFunil,
  shouldHideCidadeFilter,
  shouldHideDateFilter,
  shouldHideVendedorFilter,
} from "@/lib/bi/biRouteFilters";

describe("BI route filter capabilities", () => {
  it("does not expose controls that current-position dashboards cannot consume", () => {
    expect(shouldHideDateFilter("/bi/servicos")).toBe(true);
    expect(shouldHideDateFilter("/bi/produtos")).toBe(true);
    expect(shouldHideVendedorFilter("/bi/servicos")).toBe(true);
    expect(shouldHideCidadeFilter("/bi/servicos")).toBe(true);
  });

  it("keeps the full commercial filter set where the page contract supports it", () => {
    expect(shouldHideCategoryFunil("/bi/painel")).toBe(false);
    expect(shouldHideDateFilter("/bi/painel")).toBe(false);
    expect(shouldHideVendedorFilter("/bi/painel")).toBe(false);
    expect(shouldHideCidadeFilter("/bi/painel")).toBe(false);
  });
});
