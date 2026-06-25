import CrmConsultoresRpc from './CrmConsultoresRpc';

/**
 * CrmConsultores — delegates to the RPC-backed implementation.
 * Browser-side aggregation from ComercialDataContext is no longer used here.
 */
export default function CrmConsultores() {
  return <CrmConsultoresRpc />;
}

