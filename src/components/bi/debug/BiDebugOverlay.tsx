import { useState, useSyncExternalStore } from "react";
import { biDebug, type BiDebugEntry } from "./biDebugStore";
import { isBiDebugEnabled } from "./isBiDebugEnabled";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { getFunisByCategoria, CATEGORIA_ALL, FUNIL_ALL } from "@/lib/categoriaFunil";

/**
 * Debug overlay for BI screens.
 * Shows active filters, resolved query params, and record counts.
 *
 * Activation: import.meta.env.DEV || localStorage.getItem("bi_debug") === "true"
 */
export default function BiDebugOverlay() {
  if (!isBiDebugEnabled()) return null;

  return <OverlayContent />;
}

function OverlayContent() {
  const [collapsed, setCollapsed] = useState(true);
  const entries = useSyncExternalStore(biDebug.subscribe, biDebug.getSnapshot);
  const { dateRange, categoria, funil, vendedor, cidade, tipoAcao } = useNegociosFilter();

  const fromStr = dateRange?.from?.toISOString().slice(0, 10) ?? "—";
  const toStr = (dateRange?.to ?? dateRange?.from)?.toISOString().slice(0, 10) ?? "—";

  const resolvedFunis =
    funil !== FUNIL_ALL
      ? [funil]
      : categoria !== CATEGORIA_ALL
        ? getFunisByCategoria(categoria)
        : ["(all — no filter)"];

  return (
    <div
      style={{
        position: "fixed",
        bottom: 12,
        right: 12,
        zIndex: 99999,
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 11,
        lineHeight: 1.5,
        color: "#e2e8f0",
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        border: "1px solid rgba(148, 163, 184, 0.2)",
        borderRadius: 8,
        maxWidth: 420,
        maxHeight: collapsed ? 36 : 440,
        overflow: "hidden",
        transition: "max-height 0.2s ease",
        boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        pointerEvents: "auto",
      }}
    >
      <button
        onClick={() => setCollapsed((c) => !c)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          padding: "8px 12px",
          background: "none",
          border: "none",
          color: "#94a3b8",
          cursor: "pointer",
          fontSize: 11,
          fontFamily: "inherit",
        }}
        aria-label={collapsed ? "Expand BI debug overlay" : "Collapse BI debug overlay"}
      >
        <span style={{ color: "#fbbf24" }}>{collapsed ? "+" : "−"}</span>
        <span>BI DEBUG</span>
        {entries.length > 0 && (
          <span style={{ color: "#6ee7b7", marginLeft: "auto" }}>
            {entries.reduce((s, e) => s + e.counts.afterClientFilter, 0)} rows
          </span>
        )}
      </button>

      {!collapsed && (
        <div style={{ padding: "0 12px 10px", overflowY: "auto", maxHeight: 390 }}>
          <Section title="FILTERS (context)">
            <Row label="categoria" value={categoria} />
            <Row label="funil" value={funil} />
            <Row label="dateRange" value={`${fromStr} → ${toStr}`} />
            {vendedor && <Row label="vendedor" value={vendedor} />}
            {cidade && <Row label="cidade" value={cidade} />}
            {tipoAcao && <Row label="tipoAcao" value={tipoAcao} />}
          </Section>

          <Section title="RESOLVED QUERY (to Supabase)">
            <Row label="funis[]" value={resolvedFunis.join(", ")} />
            <Row label="date filter" value="client-side (not sent to DB)" />
          </Section>

          {entries.map((e) => (
            <Section key={e.source} title={`COUNTS — ${e.source}`}>
              <Row label="raw from server" value={String(e.counts.rawFromServer)} />
              <Row label="after dedupe" value={String(e.counts.afterDedupe)} />
              <Row label="after client filter" value={String(e.counts.afterClientFilter)} />
              {Object.entries(e.queryParams).map(([k, v]) => (
                <Row key={k} label={`param.${k}`} value={JSON.stringify(v)} />
              ))}
            </Section>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ color: "#fbbf24", marginBottom: 2, letterSpacing: "0.05em" }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 8, paddingLeft: 8 }}>
      <span style={{ color: "#94a3b8", minWidth: 130, flexShrink: 0 }}>{label}:</span>
      <span style={{ color: "#e2e8f0", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}
