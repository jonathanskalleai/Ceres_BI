import { useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { isAdminUser } from "@/lib/adminUsers";
import { fetchRegistrosComerciais, type RegistrosFetchOptions } from "@/services/registrosService";
import { fetchPipelineByVendedor } from "@/services/pipelineByVendedorService";
import { supabase } from "@/integrations/supabase/client";
import { getFunisByCategoria, type CategoriaFilter, CATEGORIA_ALL, FUNIL_ALL } from "@/lib/categoriaFunil";
import { aggregate } from "@/lib/aggregateComercial";

export interface UseComercialDataOptions {
  /** ISO date string YYYY-MM-DD — filtro server-side por aco_dth_conclusao */
  from?: string;
  to?: string;
}

export function useComercialData(
  categoria?: string,
  funil?: string,
  options?: UseComercialDataOptions,
) {
  const categoriaFilter = (categoria || CATEGORIA_ALL) as CategoriaFilter;
  const funilFilter = funil || FUNIL_ALL;

  const funis = funilFilter !== FUNIL_ALL
    ? [funilFilter]
    : categoriaFilter !== CATEGORIA_ALL
      ? getFunisByCategoria(categoriaFilter)
      : [];
  const hasFunilFilter = funis.length > 0;

  const from = options?.from;
  const to = options?.to;
  const fetchOptions: RegistrosFetchOptions | undefined = (from || to) ? { from, to } : undefined;

  const {
    data: rawRegistros,
    isLoading: loadingRegistros,
    error: queryError,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["registros-comerciais", from ?? null, to ?? null],
    queryFn: () => fetchRegistrosComerciais(fetchOptions),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  const {
    data: pipelineMap,
    isLoading: loadingPipeline,
  } = useQuery({
    queryKey: ["pipeline-by-vendedor", categoriaFilter, funilFilter],
    queryFn: () => fetchPipelineByVendedor(hasFunilFilter ? funis : undefined),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  const {
    data: funilClientes,
    isLoading: loadingFunilClientes,
  } = useQuery({
    queryKey: ["funil-clientes", categoriaFilter, funilFilter],
    queryFn: async (): Promise<Set<string> | null> => {
      if (!hasFunilFilter) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data, error } = await client
        .schema("mirror")
        .from("crm_negocios")
        .select("cli_nome")
        .in("ngo_funil", funis);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Array<{ cli_nome: string | null }>;
      return new Set(rows.map((r) => r.cli_nome ?? "").filter(Boolean));
    },
    staleTime: 5 * 60_000,
    enabled: hasFunilFilter,
    placeholderData: keepPreviousData,
  });

  const isLoading = loadingRegistros || loadingPipeline || (hasFunilFilter && loadingFunilClientes);
  const error = queryError ? (queryError as Error).message : null;
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : null;

  const data = useMemo(() => {
    if (!rawRegistros) return null;
    if (hasFunilFilter && !funilClientes) return null;
    let registros = rawRegistros.filter((r) => !isAdminUser(r.vendedor));
    if (hasFunilFilter && funilClientes) {
      registros = registros.filter((r) => funilClientes.has(r.cliente));
    }
    return aggregate(registros, pipelineMap ?? undefined);
  }, [rawRegistros, pipelineMap, hasFunilFilter, funilClientes]);

  const allData = useMemo(() => {
    if (!rawRegistros) return null;
    if (hasFunilFilter && !funilClientes) return null;
    let registros = [...rawRegistros];
    if (hasFunilFilter && funilClientes) {
      registros = registros.filter((r) => funilClientes.has(r.cliente));
    }
    return aggregate(registros, pipelineMap ?? undefined);
  }, [rawRegistros, pipelineMap, hasFunilFilter, funilClientes]);

  return { data, allData, isLoading, error, lastUpdated };
}
