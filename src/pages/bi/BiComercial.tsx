import { useState, Suspense, lazy } from 'react';
import { type DateRange } from 'react-day-picker';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const ComercialSection = lazy(() => import('@/components/bi/sections/ComercialSection'));

const FUNIS = [
  { value: '__all__', label: 'Todos os funis' },
  { value: 'VENDAS', label: 'Vendas' },
  { value: 'Vendas AP', label: 'Vendas AP' },
  { value: 'ADM', label: 'ADM' },
  { value: 'Adm AP', label: 'Adm AP' },
  { value: 'BANCOS', label: 'Bancos' },
  { value: 'Logistica AP', label: 'Logistica AP' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'OFICINA', label: 'Oficina' },
  { value: 'REPASSE DE MAQUINA', label: 'Repasse de Maquina' },
] as const;

function SectionFallback() {
  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    </div>
  );
}

export default function BiComercial() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [funil, setFunil] = useState<string>('__all__');

  return (
    <div className="p-8 space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        <Select value={funil} onValueChange={setFunil}>
          <SelectTrigger className="w-[180px] h-9 text-sm border-[rgba(214,207,193,0.12)] bg-transparent text-[#b3ab9c]">
            <SelectValue placeholder="Funil" />
          </SelectTrigger>
          <SelectContent>
            {FUNIS.map((f) => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Suspense fallback={<SectionFallback />}>
        <ComercialSection active dateRange={dateRange} funil={funil} />
      </Suspense>
    </div>
  );
}
