import { useQuery } from "@tanstack/react-query";
import { fetchMetaAnual } from "@/services/metasService";

export function useMeta(ano: number) {
  const { data, isLoading } = useQuery({
    queryKey: ["meta-anual", ano],
    queryFn: () => fetchMetaAnual(ano),
    staleTime: 5 * 60_000, // 5 min
  });
  return { metaAnual: data ?? 30_000_000, isLoading };
}
