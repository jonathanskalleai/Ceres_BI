import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { querySqlServer } from "@/services/sqlServerApi";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Database, Table2 } from "lucide-react";

const VIEWS = [
  "VW_Ceres_Empresas",
  "VW_Ceres_Usuario",
  "VW_Ceres_UsuarioXEmpresa",
  "VW_Ceres_CRM_Acoes",
  "VW_Ceres_CRM_CarteiraClientes",
  "VW_Ceres_CRM_ClienteContatos",
  "VW_Ceres_CRM_ClienteParqueMaquinas",
  "VW_Ceres_CRM_ClientePropriedade",
  "VW_Ceres_CRM_Negocios",
  "VW_Ceres_CRM_Negocios_Etapas",
  "VW_Ceres_CRM_FunilEtapa",
  "VW_Ceres_CRM_Pedidos",
  "VW_Ceres_CRM_PedidosItem",
  "VW_Ceres_CRM_PedidosUsado",
  "VW_Ceres_CRM_EstoqueVirtual",
  "VW_Ceres_CRM_TAGXACAO",
  "VW_Ceres_CRM_TAGXCLIENTE",
  "VW_Ceres_CRM_TAGXNEGOCIO",
  "VW_Ceres_CRM_TAGXPEDIDO",
  "VW_Ceres_Produtos",
  "VW_Ceres_ProdutosGrupo",
  "VW_Ceres_ProdutosMarca",
  "VW_Ceres_ProdutosModelo",
  "VW_Ceres_Agenda",
  "VW_Ceres_OrdemServico",
  "VW_Ceres_Ocorrencias",
  "VW_Ceres_AtendimentoOS",
  "VW_Ceres_AtividadeExtra",
  "VW_Ceres_TecnicoTempo",
] as const;

export const DashboardViewExplorer = () => {
  const [selectedView, setSelectedView] = useState<string>("");

  const countQuery = useQuery({
    queryKey: ["view-explorer-count", selectedView],
    queryFn: () => querySqlServer({ view: selectedView, count_only: true }),
    enabled: !!selectedView,
  });

  const dataQuery = useQuery({
    queryKey: ["view-explorer-data", selectedView],
    queryFn: () => querySqlServer({ view: selectedView, limit: 10 }),
    enabled: !!selectedView,
  });

  const columns = dataQuery.data?.data?.[0]
    ? Object.keys(dataQuery.data.data[0])
    : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Database className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-bold tracking-tight">Explorador de Views</h2>
          <p className="text-sm text-muted-foreground">
            Visualize 10 registros brutos de cada view do SQL Server
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Select value={selectedView} onValueChange={setSelectedView}>
          <SelectTrigger className="w-[360px]">
            <SelectValue placeholder="Selecione uma view..." />
          </SelectTrigger>
          <SelectContent>
            <ScrollArea className="h-72">
              {VIEWS.map((view) => (
                <SelectItem key={view} value={view}>
                  {view}
                </SelectItem>
              ))}
            </ScrollArea>
          </SelectContent>
        </Select>

        {countQuery.data && (
          <Badge variant="secondary" className="text-xs">
            <Table2 className="h-3 w-3 mr-1" />
            {countQuery.data.total.toLocaleString("pt-BR")} registros totais
          </Badge>
        )}
      </div>

      {!selectedView && (
        <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-lg">
          <p className="text-muted-foreground text-sm">
            Selecione uma view acima para visualizar os dados
          </p>
        </div>
      )}

      {selectedView && dataQuery.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
      )}

      {selectedView && dataQuery.isError && (
        <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/5">
          <p className="text-sm text-destructive font-medium">
            Erro ao buscar dados: {(dataQuery.error as Error).message}
          </p>
        </div>
      )}

      {selectedView && dataQuery.data && columns.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <ScrollArea className="w-full">
            <div className="min-w-max">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-10">
                      #
                    </th>
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataQuery.data.data.map((row, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {idx + 1}
                      </td>
                      {columns.map((col) => (
                        <td
                          key={col}
                          className="px-3 py-2 text-xs whitespace-nowrap max-w-[300px] truncate"
                          title={String(row[col] ?? "")}
                        >
                          {row[col] === null || row[col] === undefined
                            ? <span className="text-muted-foreground/50 italic">null</span>
                            : String(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      {selectedView && dataQuery.data && columns.length === 0 && (
        <div className="flex items-center justify-center h-32 border border-dashed border-border rounded-lg">
          <p className="text-muted-foreground text-sm">
            Nenhum registro encontrado nesta view
          </p>
        </div>
      )}
    </div>
  );
};
