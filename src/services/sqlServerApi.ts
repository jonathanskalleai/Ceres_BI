import { supabase } from "@/integrations/supabase/client";

interface AdvancedFilter {
  column: string;
  operator: "=" | ">=" | "<=" | "BETWEEN" | "LIKE" | "IN";
  value: string | string[];
}

export interface QueryOptions {
  view: string;
  columns?: string[];
  filters?: Record<string, string>;
  advancedFilters?: AdvancedFilter[];
  limit?: number;
  offset?: number;
  count_only?: boolean;
}

export interface QueryResponse<T = Record<string, unknown>> {
  data: T[];
  count: number;
  total: number;
}

export async function querySqlServer<T = Record<string, unknown>>(
  options: QueryOptions
): Promise<QueryResponse<T>> {
  const { data, error } = await supabase.functions.invoke("query-sqlserver", {
    body: options,
  });

  if (error) {
    throw new Error(error.message || "Erro ao consultar SQL Server");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as QueryResponse<T>;
}

async function fetchInBatches<T>(
  promises: (() => Promise<QueryResponse<T>>)[],
  concurrency = 3
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < promises.length; i += concurrency) {
    const batch = promises.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((fn) => fn()));
    results.push(...batchResults.flatMap((r) => r.data));
  }
  return results;
}

export async function fetchAllPages<T = Record<string, unknown>>(
  view: string,
  columns?: string[],
  filters?: Record<string, string>,
  advancedFilters?: AdvancedFilter[],
): Promise<T[]> {
  const { total } = await querySqlServer<T>({
    view,
    filters,
    advancedFilters,
    count_only: true,
  });

  if (total === 0) return [];

  const pageSize = 3000;

  if (total <= pageSize) {
    const { data } = await querySqlServer<T>({
      view,
      columns,
      filters,
      advancedFilters,
      limit: pageSize,
      offset: 0,
    });
    return data;
  }

  const pages = Math.ceil(total / pageSize);
  const factories = Array.from({ length: pages }, (_, i) =>
    () => querySqlServer<T>({
      view,
      columns,
      filters,
      advancedFilters,
      limit: pageSize,
      offset: i * pageSize,
    })
  );

  return fetchInBatches<T>(factories, 3);
}
