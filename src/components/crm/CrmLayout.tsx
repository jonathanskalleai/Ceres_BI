import { Outlet } from "react-router-dom";
import { NegociiosFilterProvider } from "@/contexts/NegociosFilterContext";
import { BiTopbarPortal } from "@/components/bi/BiTopbarPortal";

/**
 * Layout wrapper for all CRM pages.
 * Provides shared NegociosFilter context + topbar portal.
 * Replaces the old ComercialDataProvider (Onda 5 — Kill Switch).
 */
export default function CrmLayout() {
  return (
    <NegociiosFilterProvider>
      <BiTopbarPortal />
      <Outlet />
    </NegociiosFilterProvider>
  );
}
