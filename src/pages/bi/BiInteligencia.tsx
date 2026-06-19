import { Suspense, lazy } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useNegociosFilter } from '@/contexts/NegociosFilterContext';

const InteligenciaSection = lazy(() => import('@/components/bi/sections/InteligenciaSection'));

function SectionFallback() {
  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    </div>
  );
}

export default function BiInteligencia() {
  const { dateRange, categoria, funil } = useNegociosFilter();

  return (
    <div className="p-8 space-y-5">
      <Suspense fallback={<SectionFallback />}>
        <InteligenciaSection active dateRange={dateRange} categoria={categoria} funil={funil} />
      </Suspense>
    </div>
  );
}
