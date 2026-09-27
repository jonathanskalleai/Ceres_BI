import { Suspense, lazy } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const ProdutosSection = lazy(() => import('@/components/bi/sections/ProdutosSection'));

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

export default function BiProdutos() {
  // O período é controlado pelo topbar global. A RPC de parque é snapshot e
  // não aceita um recorte temporal local.

  return (
    <div className="p-8 space-y-5">
      <Suspense fallback={<SectionFallback />}>
        <ProdutosSection active />
      </Suspense>
    </div>
  );
}
