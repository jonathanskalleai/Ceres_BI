import { Eye } from "lucide-react";
import { CARD_BASE, MONO, MapRegion, ClientePoint, MapViewMode, formatCurrency } from "./types";

interface MapDetailsTableProps {
  mapView: MapViewMode;
  clientePoints: ClientePoint[];
  regions: MapRegion[];
}

export const MapDetailsTable = ({ mapView, clientePoints, regions }: MapDetailsTableProps) => {
  return (
    <div className={CARD_BASE}>
      <div className="flex items-center gap-2 mb-4">
        <Eye className="h-4 w-4 text-[var(--voux-accent)]" />
        <p
          className="text-[10px] tracking-[0.22em] uppercase text-[var(--voux-text-faint)]"
          style={MONO}
        >
          {mapView === "clientes" ? "CLIENTES MAPEADOS" : "DETALHAMENTO POR REGIÃO"}
        </p>
      </div>

      <div className="overflow-auto max-h-[400px]">
        {mapView === "clientes" ? (
          <ClientesTable clientePoints={clientePoints} />
        ) : (
          <RegioesTable regions={regions} />
        )}
      </div>
    </div>
  );
};

function ClientesTable({ clientePoints }: { clientePoints: ClientePoint[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr style={{ borderBottom: "1px solid var(--voux-card-border)" }}>
          {["Cliente", "Cidade", "Ações", "Última Visita"].map((h, i) => (
            <th
              key={h}
              className="py-2 text-[10px] tracking-[0.18em] uppercase text-[var(--voux-text-faint)] font-normal"
              style={{ ...MONO, textAlign: i === 2 ? "center" : i === 3 ? "right" : "left" }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...clientePoints]
          .sort((a, b) => b.totalAcoes - a.totalAcoes)
          .map((c) => (
            <tr
              key={c.cliente}
              style={{ borderBottom: "1px solid var(--voux-card-border)" }}
              className="hover:bg-[rgba(255,250,230,0.02)] transition-colors"
            >
              <td className="py-2 text-xs font-medium text-[var(--voux-text-primary)]">{c.cliente}</td>
              <td className="py-2 text-xs text-[var(--voux-text-faint)]">{c.cidade}</td>
              <td className="py-2 text-xs text-center font-semibold text-[var(--voux-accent)]" style={MONO}>
                {c.totalAcoes}
              </td>
              <td className="py-2 text-xs text-right text-[var(--voux-text-faint)]" style={MONO}>
                {c.ultimaAcao || "—"}
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}

function RegioesTable({ regions }: { regions: MapRegion[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr style={{ borderBottom: "1px solid var(--voux-card-border)" }}>
          {["Cidade", "Nível", "Ações", "Clientes", "Visitas", "Pipeline"].map((h, i) => (
            <th
              key={h}
              className="py-2 text-[10px] tracking-[0.18em] uppercase text-[var(--voux-text-faint)] font-normal"
              style={{
                ...MONO,
                textAlign: i === 0 ? "left" : i === 5 ? "right" : "center",
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...regions]
          .sort((a, b) => b.totalAcoes - a.totalAcoes)
          .map((r) => (
            <tr
              key={r.cidade}
              style={{ borderBottom: "1px solid var(--voux-card-border)" }}
              className="hover:bg-[rgba(255,250,230,0.02)] transition-colors"
            >
              <td className="py-2 text-xs font-medium text-[var(--voux-text-primary)]">{r.cidade}</td>
              <td className="py-2 text-center">
                <span
                  className="text-[9px] tracking-[0.14em] uppercase px-2 py-0.5 rounded-full"
                  style={{
                    ...MONO,
                    color: r.color,
                    border: `1px solid ${r.color}50`,
                    backgroundColor: `${r.color}14`,
                  }}
                >
                  {r.level}
                </span>
              </td>
              <td className="py-2 text-xs text-center font-semibold text-[var(--voux-text-primary)]" style={MONO}>
                {r.totalAcoes}
              </td>
              <td className="py-2 text-xs text-center text-[var(--voux-text-faint)]" style={MONO}>
                {r.clientes}
              </td>
              <td className="py-2 text-xs text-center text-[var(--voux-text-faint)]" style={MONO}>
                {r.visitas}
              </td>
              <td className="py-2 text-xs text-right font-semibold text-[var(--voux-accent)]" style={MONO}>
                {formatCurrency(r.pipeline)}
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}
