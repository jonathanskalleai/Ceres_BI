import { Outlet } from "react-router-dom";
import { NegociosFilterProvider } from "@/contexts/NegociosFilterContext";
import { BiTopbarPortal } from "@/components/bi/BiTopbarPortal";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

/**
 * Layout wrapper for all CRM pages.
 * Provides shared NegociosFilter context + topbar portal.
 */
export default function CrmLayout() {
  return (
    <NegociosFilterProvider>
      <BiTopbarPortal />
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    </NegociosFilterProvider>
  );
}
