import { Suspense, lazy } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useNegociosFilter } from '@/contexts/NegociosFilterContext';

const ComercialSection = lazy(() => import('@/components/bi/sections/ComercialSection'));

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
  const { dateRange, categoria, funil } = useNegociosFilter();

  return (
    <div className="p-8 space-y-5">
      <Suspense fallback={<SectionFallback />}>
        <ComercialSection active dateRange={dateRange} categoria={categoria} funil={funil} />
      </Suspense>
    </div>
  );
}
