import { useState, Suspense, lazy } from 'react';
import { type DateRange } from 'react-day-picker';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Skeleton } from '@/components/ui/skeleton';

const OperacionalSection = lazy(() => import('@/components/bi/sections/OperacionalSection'));

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

export default function BiOperacional() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  return (
    <div className="p-8 space-y-5">
      <div className="flex items-center gap-3">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>
      <Suspense fallback={<SectionFallback />}>
        <OperacionalSection active dateRange={dateRange} />
      </Suspense>
    </div>
  );
}
