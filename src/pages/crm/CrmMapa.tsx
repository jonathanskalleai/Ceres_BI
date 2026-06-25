import CrmMapaRpc from './CrmMapaRpc';

/**
 * CrmMapa — now delegates to the RPC-based implementation.
 * The old client-side aggregation via ComercialDataContext is preserved
 * in DashboardMapa but no longer used here.
 */
export default function CrmMapa() {
  return <CrmMapaRpc />;
}
