import { Outlet } from "react-router-dom";
import { NegociosFilterProvider } from "@/contexts/NegociosFilterContext";
import { BiTopbarPortal } from "@/components/bi/BiTopbarPortal";

/**
 * Layout wrapper for all CRM pages.
 * Provides shared NegociosFilter context + topbar portal.
 */
export default function CrmLayout() {
  return (
    <NegociosFilterProvider>
      <BiTopbarPortal />
      <Outlet />
    </NegociosFilterProvider>
  );
}
