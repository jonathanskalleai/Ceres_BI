import CrmOverviewRpc from './CrmOverviewRpc';

/**
 * CrmOverview — now delegates to the RPC-based implementation.
 * The old DashboardOverview (browser-side aggregation) is preserved as fallback
 * but no longer used here.
 */
export default function CrmOverview() {
  return <CrmOverviewRpc />;
}
