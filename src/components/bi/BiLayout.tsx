import { Outlet } from "react-router-dom";
import { NegociiosFilterProvider } from "@/contexts/NegociosFilterContext";
import { BiTopbarPortal } from "./BiTopbarPortal";
import BiDebugOverlay from "./debug/BiDebugOverlay";

/**
 * Layout wrapper for all BI and Tools pages.
 * Provides shared filter context + topbar portal with Categoria/Funil/DateRange.
 */
export default function BiLayout() {
  return (
    <NegociiosFilterProvider>
      <BiTopbarPortal />
      <Outlet />
      <BiDebugOverlay />
    </NegociiosFilterProvider>
  );
}
