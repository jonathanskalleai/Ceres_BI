import { CARD_BASE, MONO, ClientePoint, MapRegion, MapViewMode } from "./types";

interface MapKpisProps {
  mapView: MapViewMode;
  clientePoints: ClientePoint[];
  alta: MapRegion[];
  media: MapRegion[];
  baixa: MapRegion[];
}

export const MapKpis = ({ mapView, clientePoints, alta, media, baixa }: MapKpisProps) => {
  if (mapView === "clientes") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={CARD_BASE} style={{ borderLeft: "3px solid var(--voux-accent)" }}>
          <p className="text-[10px] tracking-[0.22em] uppercase text-[var(--voux-text-faint)] mb-3" style={MONO}>
            CLIENTES MAPEADOS
          </p>
          <p className="text-[28px] font-bold leading-none tracking-[-0.02em] text-[var(--voux-accent)]">
            {clientePoints.length}
          </p>
          <p className="text-[11px] text-[var(--voux-text-faint)] mt-2" style={MONO}>
            com coordenadas GPS
          </p>
        </div>

        <div className={CARD_BASE} style={{ borderLeft: "3px solid var(--voux-text-primary)" }}>
          <p className="text-[10px] tracking-[0.22em] uppercase text-[var(--voux-text-faint)] mb-3" style={MONO}>
            TOTAL DE AÇÕES
          </p>
          <p className="text-[28px] font-bold leading-none tracking-[-0.02em] text-[var(--voux-text-primary)]">
            {clientePoints.reduce((s, c) => s + c.totalAcoes, 0)}
          </p>
          <p className="text-[11px] text-[var(--voux-text-faint)] mt-2" style={MONO}>
            registros no período
          </p>
        </div>

        <div className={CARD_BASE} style={{ borderLeft: "3px solid var(--voux-success)" }}>
          <p className="text-[10px] tracking-[0.22em] uppercase text-[var(--voux-text-faint)] mb-3" style={MONO}>
            CIDADES COBERTAS
          </p>
          <p className="text-[28px] font-bold leading-none tracking-[-0.02em]" style={{ color: "var(--voux-success)" }}>
            {new Set(clientePoints.map((c) => c.cidade)).size}
          </p>
          <p className="text-[11px] text-[var(--voux-text-faint)] mt-2" style={MONO}>
            municípios atendidos
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className={CARD_BASE} style={{ borderLeft: "3px solid var(--voux-success)" }}>
        <p className="text-[10px] tracking-[0.22em] uppercase text-[var(--voux-text-faint)] mb-3" style={MONO}>
          ALTA ATIVIDADE
        </p>
        <p className="text-[28px] font-bold leading-none tracking-[-0.02em]" style={{ color: "var(--voux-success)" }}>
          {alta.length}
        </p>
        <p className="text-[11px] text-[var(--voux-text-faint)] mt-2" style={MONO}>
          regiões — verde no mapa
        </p>
      </div>

      <div className={CARD_BASE} style={{ borderLeft: "3px solid var(--voux-warning)" }}>
        <p className="text-[10px] tracking-[0.22em] uppercase text-[var(--voux-text-faint)] mb-3" style={MONO}>
          MÉDIA ATIVIDADE
        </p>
        <p className="text-[28px] font-bold leading-none tracking-[-0.02em]" style={{ color: "var(--voux-warning)" }}>
          {media.length}
        </p>
        <p className="text-[11px] text-[var(--voux-text-faint)] mt-2" style={MONO}>
          regiões — amarelo no mapa
        </p>
      </div>

      <div className={CARD_BASE} style={{ borderLeft: "3px solid var(--voux-danger)" }}>
        <p className="text-[10px] tracking-[0.22em] uppercase text-[var(--voux-text-faint)] mb-3" style={MONO}>
          BAIXA ATIVIDADE
        </p>
        <p className="text-[28px] font-bold leading-none tracking-[-0.02em]" style={{ color: "var(--voux-danger)" }}>
          {baixa.length}
        </p>
        <p className="text-[11px] text-[var(--voux-text-faint)] mt-2" style={MONO}>
          regiões — vermelho no mapa
        </p>
      </div>
    </div>
  );
};
