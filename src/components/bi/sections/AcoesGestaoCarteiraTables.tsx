import { AlertCircle } from "lucide-react";
import { fmtBRL, fmtNum } from "@/lib/formatters";
import { fmtDiasSemContato, fmtRatio, DASH } from "@/lib/bi/acoesGestaoUtils";
import { InlineBar } from "@/components/bi/charts/InlineBar";
import type { AcoesDesperdicioRow, AcoesNegativaRow, AcoesSemContatoRow } from "@/types/biRpc";

const TH = "text-left py-2 px-2 font-medium text-[var(--voux-text-muted)]";
const TD = "py-2 px-2 text-[var(--voux-text-primary)]";
const TD_SOFT = "py-2 px-2 text-[var(--voux-text-soft)]";

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  );
}

function zebra(i: number): string {
  return i % 2 === 1 ? "bg-foreground/[0.02]" : "";
}

/** Clientes ordenados por dias sem contato (drill-down do chart de risco). Mantido internamente — sem consumer apos Story 2-A. */
function SemContatoTable({ rows }: { rows: AcoesSemContatoRow[] }) {
  return (
    <Wrapper>
      <thead className="sticky top-0 z-10 bg-[var(--voux-card-from)]">
        <tr>
          <th className={TH}>Cliente</th>
          <th className={TH}>Cidade</th>
          <th className={TH}>Consultor</th>
          <th className={TH}>Sem contato</th>
          <th className={TH}>Ultima acao</th>
          <th className={TH}>Oportunidade aberta</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.clienteId}-${i}`} className={`border-t border-[var(--voux-card-border)]/30 ${zebra(i)}`}>
            <td className={`${TD} max-w-[220px] truncate`}>{r.cliente ?? DASH}</td>
            <td className={`${TD_SOFT} max-w-[130px] truncate`}>{r.cidade ?? DASH}</td>
            <td className={`${TD_SOFT} max-w-[150px] truncate`}>{r.consultor ?? DASH}</td>
            <td className={`${TD} whitespace-nowrap tabular-nums`}>
              {fmtDiasSemContato(r.dias, r.semAcaoNoAno)}
            </td>
            <td className={`${TD_SOFT} whitespace-nowrap`}>{r.ultimaAcao ?? DASH}</td>
            <td className="py-2 px-2">
              {r.temOportunidadeAberta ? (
                <span className="inline-flex items-center gap-1 text-[var(--voux-champagne-400)]">
                  <AlertCircle className="h-3 w-3" aria-hidden="true" />
                  Sim
                </span>
              ) : (
                <span className="text-[var(--voux-text-muted)]">Nao</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </Wrapper>
  );
}

/** Esforco gasto por cliente sem oportunidade levantada — UX Opcao D: InlineBar + badge NULL. */
export function DesperdicioTable({ rows }: { rows: AcoesDesperdicioRow[] }) {
  // InlineBar: maximo local da pagina (nunca 0 aqui por regra da lista).
  const maxGravidade = Math.max(...rows.map((r) => r.visitasPorOportunidade ?? r.visitas), 1);

  return (
    <Wrapper>
      <thead className="sticky top-0 z-10 bg-[var(--voux-card-from)]">
        <tr>
          <th className={TH}>Cliente</th>
          <th className={TH}>Cidade</th>
          <th className={TH}>Visitas</th>
          <th className={TH}>Acoes</th>
          <th className={TH}>Oportunidades</th>
          <th className={TH}>Gravidade</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          // Badge vermelho: oportunidades === 0 E visitas >= 10.
          const isAlert = r.oportunidades === 0 && r.visitas >= 10;
          const rowBg = isAlert
            ? "bg-[color-mix(in_oklch,var(--voux-danger)_8%,transparent)]"
            : zebra(i);

          return (
            <tr key={`${r.clienteId}-${i}`} className={`border-t border-[var(--voux-card-border)]/30 ${rowBg}`}>
              <td className={`${TD} max-w-[200px]`}>
                <div className="truncate" title={r.cliente ?? undefined}>{r.cliente ?? DASH}</div>
                {isAlert && (
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-[var(--voux-danger)]">
                    <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
                    SEM OPORTUNIDADE
                  </div>
                )}
              </td>
              <td className={`${TD_SOFT} max-w-[110px] truncate`}>{r.cidade ?? DASH}</td>
              <td className={`${TD} tabular-nums`}>{fmtNum(r.visitas)}</td>
              <td className={`${TD_SOFT} tabular-nums`}>{fmtNum(r.acoes)}</td>
              <td className={`${TD} tabular-nums`}>{fmtNum(r.oportunidades)}</td>
              <td className={`${TD} min-w-[120px]`}>
                <InlineBar
                  value={r.visitasPorOportunidade ?? r.visitas}
                  max={maxGravidade}
                  format={(v) => fmtRatio(v === r.visitas && r.oportunidades === 0 ? null : r.visitasPorOportunidade)}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </Wrapper>
  );
}

/** Clientes cujos 3 ultimos negocios comerciais foram TODOS perdidos. */
export function NegativasTable({ rows }: { rows: AcoesNegativaRow[] }) {
  return (
    <Wrapper>
      <thead className="sticky top-0 z-10 bg-[var(--voux-card-from)]">
        <tr>
          <th className={TH}>Cliente</th>
          <th className={TH}>Cidade</th>
          <th className={TH}>Valor perdido</th>
          <th className={TH}>Ultima perda</th>
          <th className={TH}>Motivos dos 3 negocios</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.clienteId}-${i}`} className={`border-t border-[var(--voux-card-border)]/30 ${zebra(i)}`}>
            <td className={`${TD} max-w-[200px] truncate`}>{r.cliente ?? DASH}</td>
            <td className={`${TD_SOFT} max-w-[120px] truncate`}>{r.cidade ?? DASH}</td>
            <td className={`${TD} whitespace-nowrap tabular-nums`}>
              {r.valorPerdido != null ? fmtBRL(r.valorPerdido) : DASH}
            </td>
            <td className={`${TD_SOFT} whitespace-nowrap`}>{r.ultimaPerda ?? DASH}</td>
            <td className={TD_SOFT}>
              <ul className="space-y-0.5">
                {r.negocios.map((n) => (
                  <li key={n.negocio} className="truncate">
                    <span className="text-[var(--voux-text-muted)]">{n.data ?? DASH}</span>{" "}
                    {n.motivoPerda ?? "motivo nao registrado"}
                    {n.valor != null && <span className="text-[var(--voux-text-muted)]"> · {fmtBRL(n.valor)}</span>}
                  </li>
                ))}
              </ul>
            </td>
          </tr>
        ))}
      </tbody>
    </Wrapper>
  );
}
