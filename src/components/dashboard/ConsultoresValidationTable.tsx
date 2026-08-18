import type { RpcConsultorResumoAcoes } from "@/types/consultoresRpc";
import { formatBRL, formatDateBR } from "@/lib/dateUtils";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConsultoresValidationTableProps {
  resumo: RpcConsultorResumoAcoes[];
  from: string;
  to: string;
  onSelectConsultor: (consultor: string) => void;
}

function formatRate(value: number | null): string {
  return value == null ? "—" : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

const CARD = "rounded-xl border";

/**
 * Quadro auditável com ranking + totais. Cada coluna usa a mesma fonte e
 * regra da tela Ações; valores nunca são derivados da lista de ações no browser.
 */
export function ConsultoresValidationTable({
  resumo,
  from,
  to,
  onSelectConsultor,
}: ConsultoresValidationTableProps) {
  const ranking = [...resumo].sort((a, b) =>
    Number(b.valor_ganho) - Number(a.valor_ganho)
    || Number(b.visitas) - Number(a.visitas)
    || Number(b.acoes) - Number(a.acoes)
    || a.consultor.localeCompare(b.consultor, "pt-BR"),
  );

  const totais = resumo.reduce(
    (acc, item) => ({
      acoes: acc.acoes + Number(item.acoes),
      visitas: acc.visitas + Number(item.visitas),
      negociosAbertos: acc.negociosAbertos + Number(item.negocios_abertos_tocados),
      carteira: acc.carteira + Number(item.carteira_ativa_trabalhada),
      oportunidadesAbertas: acc.oportunidadesAbertas + Number(item.oportunidades_abertas),
      pipelineAberto: acc.pipelineAberto + Number(item.pipeline_aberto_gerado),
      ganhos: acc.ganhos + Number(item.ganhos),
      valorGanho: acc.valorGanho + Number(item.valor_ganho),
      perdidos: acc.perdidos + Number(item.perdidos),
      valorPerdido: acc.valorPerdido + Number(item.valor_perdido),
      oportunidadesGeradas: acc.oportunidadesGeradas + Number(item.oportunidades_geradas),
    }),
    {
      acoes: 0, visitas: 0, negociosAbertos: 0, carteira: 0,
      oportunidadesAbertas: 0, pipelineAberto: 0, ganhos: 0,
      valorGanho: 0, perdidos: 0, valorPerdido: 0, oportunidadesGeradas: 0,
    },
  );

  const taxaTotal = totais.oportunidadesGeradas > 0
    ? totais.ganhos * 100 / totais.oportunidadesGeradas
    : null;

  const TH = "text-[10px] tracking-[0.12em] uppercase font-medium py-2.5 px-3";
  const TD = "py-2.5 px-3 text-[12px] tabular-nums";

  return (
    <div
      className={cn(CARD, "overflow-hidden")}
      style={{ borderColor: "var(--voux-card-border)", background: "var(--surface-raised)" }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p
            className="text-[10px] tracking-[0.12em] uppercase font-medium"
            style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}
          >
            CONFERÊNCIA
          </p>
          <h3
            className="text-sm font-semibold mt-1"
            style={{ fontFamily: "var(--voux-font-display)", color: "var(--voux-text-heading)" }}
          >
            Ranking e conferência por consultor
          </h3>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] tabular-nums"
          style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-accent)", borderColor: "var(--voux-card-border)" }}
        >
          <CalendarDays className="h-3 w-3" />
          {formatDateBR(from)} a {formatDateBR(to)}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px]" style={{ fontFamily: "var(--voux-font-sans)" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--voux-card-border)" }}>
              <th className={cn(TH, "text-right w-14")} style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>POS</th>
              <th className={cn(TH, "text-left min-w-[200px]")} style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>CONSULTOR</th>
              <th className={cn(TH, "text-right")} style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>VENDAS</th>
              <th className={cn(TH, "text-right")} style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>VISITAS</th>
              <th className={cn(TH, "text-right")} style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>AÇÕES</th>
              <th className={cn(TH, "text-right")} style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>PIPELINE</th>
              <th className={cn(TH, "text-right")} style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>CARTEIRA</th>
              <th className={cn(TH, "text-right")} style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>PERDIDOS</th>
              <th className={cn(TH, "text-right")} style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>CONV.</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((item, index) => (
              <tr
                key={item.consultor}
                className="cursor-pointer transition-colors duration-150 hover:bg-[rgba(0,0,0,0.02)]"
                style={{ borderBottom: "1px solid var(--voux-card-border)" }}
                onClick={() => onSelectConsultor(item.consultor)}
              >
                <td className={cn(TD, "text-right font-bold")} style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>
                  {index + 1}
                </td>
                <td className={cn(TD, "text-left font-medium")} style={{ color: "var(--voux-text-heading)" }}>
                  {item.consultor}
                </td>
                <td className={cn(TD, "text-right")}>
                  <span className="font-semibold" style={{ color: "#1f6e3f" }}>{formatBRL(Number(item.valor_ganho))}</span>
                  <br />
                  <span className="text-[10px]" style={{ color: "var(--voux-text-faint)" }}>{item.ganhos} ganhos</span>
                </td>
                <td className={cn(TD, "text-right")} style={{ color: "var(--voux-text-primary)" }}>{item.visitas}</td>
                <td className={cn(TD, "text-right")} style={{ color: "var(--voux-text-primary)" }}>{item.acoes}</td>
                <td className={cn(TD, "text-right")}>
                  <span style={{ color: "var(--voux-text-primary)" }}>{formatBRL(Number(item.pipeline_aberto_gerado))}</span>
                  <br />
                  <span className="text-[10px]" style={{ color: "var(--voux-text-faint)" }}>{item.oportunidades_abertas} abertas</span>
                </td>
                <td className={cn(TD, "text-right")}>
                  <span style={{ color: "var(--voux-text-primary)" }}>{formatBRL(Number(item.carteira_ativa_trabalhada))}</span>
                  <br />
                  <span className="text-[10px]" style={{ color: "var(--voux-text-faint)" }}>{item.negocios_abertos_tocados} tocados</span>
                </td>
                <td className={cn(TD, "text-right")}>
                  <span style={{ color: "#b8421c" }}>{formatBRL(Number(item.valor_perdido))}</span>
                  <br />
                  <span className="text-[10px]" style={{ color: "var(--voux-text-faint)" }}>{item.perdidos} neg.</span>
                </td>
                <td className={cn(TD, "text-right font-semibold")} style={{ color: "var(--voux-text-primary)" }}>
                  {formatRate(item.taxa_ganho)}
                </td>
              </tr>
            ))}
          </tbody>
          {/* Footer totais */}
          <tfoot>
            <tr style={{ borderTop: "2px solid var(--voux-card-border)", background: "var(--surface-base)" }}>
              <td className={cn(TD, "text-right")} style={{ color: "var(--voux-text-faint)" }}>—</td>
              <td className={cn(TD, "text-left font-semibold")} style={{ color: "var(--voux-text-heading)" }}>Total</td>
              <td className={cn(TD, "text-right")}>
                <span className="font-semibold" style={{ color: "#1f6e3f" }}>{formatBRL(totais.valorGanho)}</span>
                <br />
                <span className="text-[10px]" style={{ color: "var(--voux-text-faint)" }}>{totais.ganhos} ganhos</span>
              </td>
              <td className={cn(TD, "text-right font-semibold")} style={{ color: "var(--voux-text-primary)" }}>{totais.visitas}</td>
              <td className={cn(TD, "text-right font-semibold")} style={{ color: "var(--voux-text-primary)" }}>{totais.acoes}</td>
              <td className={cn(TD, "text-right")}>
                <span className="font-semibold" style={{ color: "var(--voux-text-primary)" }}>{formatBRL(totais.pipelineAberto)}</span>
                <br />
                <span className="text-[10px]" style={{ color: "var(--voux-text-faint)" }}>{totais.oportunidadesAbertas} abertas</span>
              </td>
              <td className={cn(TD, "text-right")}>
                <span className="font-semibold" style={{ color: "var(--voux-text-primary)" }}>{formatBRL(totais.carteira)}</span>
                <br />
                <span className="text-[10px]" style={{ color: "var(--voux-text-faint)" }}>{totais.negociosAbertos} tocados</span>
              </td>
              <td className={cn(TD, "text-right")}>
                <span className="font-semibold" style={{ color: "#b8421c" }}>{formatBRL(totais.valorPerdido)}</span>
                <br />
                <span className="text-[10px]" style={{ color: "var(--voux-text-faint)" }}>{totais.perdidos} neg.</span>
              </td>
              <td className={cn(TD, "text-right font-semibold")} style={{ color: "var(--voux-text-primary)" }}>{formatRate(taxaTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Nota explicativa */}
      <div className="px-4 py-2.5 border-t text-[10px]" style={{ borderColor: "var(--voux-card-border)", color: "var(--voux-text-faint)" }}>
        Conversão = ganhos ÷ oportunidades no período · "—" = sem oportunidades no denominador · Repasse de Máquina não entra em pipeline/ganhos/perdas.
      </div>
    </div>
  );
}
