import { Trophy, XCircle } from "lucide-react";
import { AcoesDegrauBar } from "@/components/bi/AcoesDegrauBar";
import type { AcoesFunil } from "@/types/biRpc";

const MONO = "var(--voux-font-mono)";
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });

interface Props { funil: AcoesFunil; perdidosSemAtribuicao: number; }

/**
 * Wrapper fino (≤60 linhas) com 2 AcoesDegrauBar: Ganho e Perdido (Story 1-A).
 * DegrauBar substitui o antigo card inline. Fontes vao para tooltip + footer.
 */
export function AcoesDesfechosPeriodo({ funil, perdidosSemAtribuicao }: Props) {
  const totalRef = Math.max(funil.ganhos, funil.perdidos, 1);

  return (
    <div className="mt-5">
      <p className="mb-2 text-[10px] uppercase text-[var(--voux-text-muted)]" style={{ fontFamily: MONO, letterSpacing: "0.22em" }}>
        Desfechos do periodo
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
        <AcoesDegrauBar icon={Trophy} label="Ganhos" valor={funil.ganhos} base={totalRef} accent="success"
          hint="crm_pedidos · data de aprovacao do pedido · R$ de pedido" />
        <AcoesDegrauBar icon={XCircle} label="Perdidos" valor={funil.perdidos} base={totalRef} accent="danger"
          hint="crm_negocios · data de fechamento do negocio · R$ negociado (potencial)" />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-[var(--voux-text-muted)]">
        <span className="text-[var(--voux-text-primary)] font-medium">pedidos aprovados</span>
        {" · "}<span className="text-[var(--voux-text-primary)] font-medium">{funil.ganhos} Ganho{funil.ganhos !== 1 ? "s" : ""} · {funil.perdidos} Perdido{funil.perdidos !== 1 ? "s" : ""}</span>
        {" — "}fontes e datas diferentes, nao se somam
        {" · "}<span className="text-[var(--voux-text-primary)] font-medium">R$ no card &quot;Valor Ganho&quot;</span>
        {" · "}<span style={{ color: "var(--voux-danger)" }}>{brl(funil.valorPerdido)}</span>
        {" · "}<span className="italic">crm_pedidos · data de aprovacao do pedido · R$ de pedido</span>
        {" · "}<span className="italic">crm_negocios · data de fechamento do negocio · R$ negociado (potencial)</span>
      </p>
      {perdidosSemAtribuicao > 0 && (
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--voux-text-muted)]">
          <strong className="text-[var(--voux-text-primary)]">{perdidosSemAtribuicao} perdido(s) sem consultor atribuido:</strong> entram no total, mas somem ao filtrar por consultor.
        </p>
      )}
    </div>
  );
}
