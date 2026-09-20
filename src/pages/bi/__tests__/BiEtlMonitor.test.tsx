import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BiEtlMonitor from "@/pages/bi/BiEtlMonitor";
import { useEtlStatus } from "@/hooks/bi/useEtlStatus";

vi.mock("@/hooks/bi/useEtlStatus", () => ({ useEtlStatus: vi.fn() }));

const mockedUseEtlStatus = vi.mocked(useEtlStatus);
const refetch = vi.fn();

describe("BiEtlMonitor", () => {
  beforeEach(() => refetch.mockReset());

  it("never reports OK when the status RPC fails", () => {
    mockedUseEtlStatus.mockReturnValue({
      tables: [], isLoading: false, error: new Error("timeout"), refetch,
    } as ReturnType<typeof useEtlStatus>);

    render(<BiEtlMonitor />);

    expect(screen.getByRole("alert")).toHaveTextContent("estado não é OK");
    expect(screen.queryByText("OK")).not.toBeInTheDocument();
  });

  it("treats an empty response as unavailable", () => {
    mockedUseEtlStatus.mockReturnValue({
      tables: [], isLoading: false, error: null, refetch,
    } as ReturnType<typeof useEtlStatus>);

    render(<BiEtlMonitor />);

    expect(screen.getByRole("alert")).toHaveTextContent("não retornou nenhuma tabela");
    expect(screen.queryByText("OK")).not.toBeInTheDocument();
  });

  it("reports OK only when at least one table is healthy", () => {
    mockedUseEtlStatus.mockReturnValue({
      tables: [{
        table_name: "crm_acoes",
        source_view: "vw_acoes",
        rows_synced: 10,
        last_sync_at: "2026-09-20T12:00:00Z",
        minutes_since_sync: 10,
        error_message: null,
        status: "success",
      }],
      isLoading: false,
      error: null,
      refetch,
    } as ReturnType<typeof useEtlStatus>);

    render(<BiEtlMonitor />);

    expect(screen.getByText("OK")).toBeInTheDocument();
  });
});
