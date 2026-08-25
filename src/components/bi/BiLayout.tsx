import { Outlet } from "react-router-dom";
import { NegociosFilterProvider } from "@/contexts/NegociosFilterContext";
import { BiTopbarPortal } from "./BiTopbarPortal";
import BiDebugOverlay from "./debug/BiDebugOverlay";
import { YaChat } from "./YaChat";

/**
 * Layout wrapper for all BI and Tools pages.
 * Provides shared filter context + topbar portal with Categoria/Funil/DateRange.
 */
export default function BiLayout() {
  return (
    <NegociosFilterProvider>
      <BiTopbarPortal />
      <Outlet />
      <BiDebugOverlay />
      <YaChat />
    </NegociosFilterProvider>
  );
}
