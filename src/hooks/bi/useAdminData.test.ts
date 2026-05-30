import { describe, it, expect, vi } from "vitest";

vi.mock("@/services/bi/adminBIService", () => ({
  fetchCarteira: vi.fn().mockResolvedValue([]),
  fetchOrgCounts: vi.fn().mockResolvedValue({ empresas: 0, usuarios: 0 }),
}));

import { aggregateAdmin } from "@/hooks/bi/useAdminData";
import type { CarteiraRow } from "@/services/bi/adminBIService";

const cli = (over: Partial<CarteiraRow>): CarteiraRow => ({
  CLI_idCliente: 1, CLI_TipoCliente: "Sem classificação", CLI_Prospect: "Não",
  CLI_UF: "SC", CLI_Cidade: "Xanxere", USR_NomeUsuario: "Ana", ...over,
});

describe("aggregateAdmin", () => {
  it("returns zeroed KPIs for empty carteira", () => {
    const { kpis } = aggregateAdmin([], 0);
    expect(kpis.totalClientes).toBe(0);
    expect(kpis.prospects).toBe(0);
  });

  it("dedupes clients and splits prospects from active", () => {
    const rows = [
      cli({ CLI_idCliente: "A", CLI_Prospect: "Sim", CLI_UF: "SC" }),
      cli({ CLI_idCliente: "A", CLI_Prospect: "Sim", CLI_UF: "SC" }), // duplicata
      cli({ CLI_idCliente: "B", CLI_Prospect: "Não", CLI_UF: "PR" }),
      cli({ CLI_idCliente: "C", CLI_Prospect: "Não", CLI_UF: "PR" }),
    ];
    const { kpis, porUF } = aggregateAdmin(rows, 4);
    expect(kpis.totalClientes).toBe(3); // dedup
    expect(kpis.prospects).toBe(1);
    expect(kpis.ativos).toBe(2);
    expect(kpis.ufsCobertas).toBe(2);
    expect(kpis.empresas).toBe(4);
    expect(porUF.find((u) => u.name === "PR")?.value).toBe(2);
  });
});
