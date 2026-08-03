import { Trophy, XCircle } from "lucide-react";
import type { AcoesFunil } from "@/types/biRpc";

/**
 * Os dois DESFECHOS do periodo de /bi/acoes, lado a lado.
 *
 * Extraido de `AcoesFunilConversao` para conter o tamanho daquele arquivo
 * (coding-standards #4), mas a separacao tambem e semantica: ganho e perda NAO
 * sao degraus abaixo de oportunidade. Sao eventos paralelos, de fontes e datas
 * de competencia diferentes, e a soma dos dois valores nao significa nada.
 */

const MONO = "var(--voux-font-mono)";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

const num = (v: number) => v.toLocaleString("pt-BR");

interface DesfechoProps {
  icon: typeof Trophy;
  label: string;
  quantidade: number;
  unidade: string;
  /**
   * AUSENTE de proposito no lado do ganho: `rpc_acoes_funil_gestao` devolve a
   * CONTAGEM de pedidos aprovados, nao a soma deles. Renderizar R$ 0 aqui seria
   * afirmar um valor que esta RPC nao mediu — o R$ ganho vive no card
   * "Valor Ganho", que le a `rpc_acoes_bi`.
   */
  valor?: number;
  fonte: string;
  accent: string;
}

function Desfecho({ icon: Icon, label, quantidade, unidade, valor, fonte, accent }: DesfechoProps) {
  return (
    <div className="rounded-xl border border-[var(--voux-card-border)] p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" style={{ color: accent }} aria-hidden="true" />
        <span
          className="text-[10px] uppercase text-[var(--voux-text-muted)]"
          style={{ fontFamily: MONO, letterSpacing: "0.18em" }}
        >
          {label}
        </span>
      </div>
      <p
        className="mt-1 text-lg font-semibold tabular-nums text-[var(--voux-text-heading)]"
        style={{ fontFamily: "var(--voux-font-display)" }}
      >
        {num(quantidade)} <span className="text-[11px] font-normal text-[var(--voux-text-muted)]">{unidade}</span>
      </p>
      {valor != null ? (
        <p className="text-sm tabular-nums text-[var(--voux-text-primary)]" style={{ fontFamily: MONO }}>
          {brl(valor)}
        </p>
      ) : (
        <p className="text-[11px] text-[var(--voux-text-muted)]">R$ no card “Valor Ganho”</p>
      )}
      <p className="mt-1 text-[10px] leading-snug text-[var(--voux-text-faint)]">{fonte}</p>
    </div>
  );
}

interface Props {
  funil: AcoesFunil;
  /**
   * O total global INCLUI o perdido sem dono; ao filtrar por consultor ele sai.
   * Sem dizer isso, a soma por consultor parece simplesmente errada.
   */
  perdidosSemAtribuicao: number;
}

export function AcoesDesfechosPeriodo({ funil, perdidosSemAtribuicao }: Props) {
  return (
    <div className="mt-5">
      <p
        className="mb-2 text-[10px] uppercase text-[var(--voux-text-muted)]"
        style={{ fontFamily: MONO, letterSpacing: "0.22em" }}
      >
        Desfechos do periodo — fontes e datas diferentes, nao se somam
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Desfecho
          icon={Trophy}
          label="Ganhos"
          quantidade={funil.ganhos}
          unidade="pedidos aprovados"
          fonte="crm_pedidos · data de aprovacao do pedido · R$ de pedido"
          accent="var(--voux-success)"
        />
        <Desfecho
          icon={XCircle}
          label="Perdidos"
          quantidade={funil.perdidos}
          unidade="negocios"
          valor={funil.valorPerdido}
          fonte="crm_negocios · data de fechamento do negocio · R$ negociado (potencial)"
          accent="var(--voux-danger)"
        />
      </div>
      {perdidosSemAtribuicao > 0 && (
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--voux-text-muted)]">
          <strong className="text-[var(--voux-text-primary)]">
            {num(perdidosSemAtribuicao)} perdido(s) sem consultor atribuido:
          </strong>{" "}
          entram neste total global, mas somem ao filtrar por consultor — o negocio nao tem dono mapeavel. A
          soma por consultor fica menor que este numero de proposito.
        </p>
      )}
    </div>
  );
}
