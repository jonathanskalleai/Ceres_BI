import { Filters } from "@/types/comercial";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface DashboardFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  anos: string[];
  vendedores: { nome: string }[];
  cidades: string[];
}

const MESES = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Marco" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

export function DashboardFilters({
  filters,
  onFiltersChange,
  anos,
  vendedores,
  cidades,
}: DashboardFiltersProps) {
  const updateFilter = (key: keyof Filters, value: string) => {
    onFiltersChange({ ...filters, [key]: value === "__all__" ? "" : value });
  };

  const hasActiveFilter = Object.values(filters).some((v) => v !== "");

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={filters.ano || "__all__"} onValueChange={(v) => updateFilter("ano", v)}>
        <SelectTrigger className="h-8 w-[100px] text-xs">
          <SelectValue placeholder="Ano" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos anos</SelectItem>
          {anos.map((a) => (
            <SelectItem key={a} value={a}>{a}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.mes || "__all__"} onValueChange={(v) => updateFilter("mes", v)}>
        <SelectTrigger className="h-8 w-[120px] text-xs">
          <SelectValue placeholder="Mes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos meses</SelectItem>
          {MESES.map((m) => (
            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.vendedor || "__all__"} onValueChange={(v) => updateFilter("vendedor", v)}>
        <SelectTrigger className="h-8 w-[140px] text-xs">
          <SelectValue placeholder="Consultor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos consultores</SelectItem>
          {vendedores.map((v) => (
            <SelectItem key={v.nome} value={v.nome}>{v.nome}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.cidade || "__all__"} onValueChange={(v) => updateFilter("cidade", v)}>
        <SelectTrigger className="h-8 w-[130px] text-xs">
          <SelectValue placeholder="Cidade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todas cidades</SelectItem>
          {cidades.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilter && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs text-muted-foreground"
          onClick={() => onFiltersChange({ vendedor: "", cidade: "", periodo: "", ano: "", mes: "", tipoAcao: "" })}
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Limpar
        </Button>
      )}
    </div>
  );
}
