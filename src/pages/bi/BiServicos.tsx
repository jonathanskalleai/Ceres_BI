import { useState, Suspense, lazy } from 'react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { type DateRange } from 'react-day-picker';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Skeleton } from '@/components/ui/skeleton';

const ServicosSection = lazy(() => import('@/components/bi/sections/ServicosSection'));

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

export default function BiServicos() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  }));

  return (
    <div className="p-8 space-y-5">
      <div className="flex items-center gap-3">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>
      <Suspense fallback={<SectionFallback />}>
        <ServicosSection active dateRange={dateRange} />
      </Suspense>
    </div>
  );
}
