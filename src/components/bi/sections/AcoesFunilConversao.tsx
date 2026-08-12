import { Eye, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BiGestaoErro } from "@/components/bi/BiGestaoErro";
import { AcoesDesfechosPeriodo } from "@/components/bi/sections/AcoesDesfechosPeriodo";
import { AcoesDegrauBar } from "@/components/bi/AcoesDegrauBar";
import { funilRatios, fmtRatio } from "@/lib/bi/acoesGestaoUtils";
import type { AcoesFunil, AcoesFunilMeta } from "@/types/biRpc";

const CARD =
  "rounded-2xl border border-[var(--voux-card-border)] bg-[var(--surface-raised)] p-5 shadow-[var(--voux-card-shadow)]";

const MONO = "var(--voux-font-mono)";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

/**
 * Texto fixo, pedido literalmente pelo usuario. Nao e decoracao: e o unico
 * lugar da tela que avisa que o MESMO seletor de periodo esta sendo aplicado a
 * Cinco datas de competencia diferentes.
 */
const NOTA_PERIODO =
  "Período dos eventos: visitas por conclusão, oportunidades pela primeira entrada no funil VENDAS, etapa inicial por entrada na etapa, ganhos por aprovação de pedido e perdas por fechamento.";

interface Estagio {
  key: keyof Pick<AcoesFunil, "visitas" | "oportunidades">;
  label: string;
  icon: typeof Eye;
  hint: string;
}

/**
 * Os dois degraus principais de atividade/origem. Ganhos e Perdidos sao
 * desfechos paralelos, com fonte propria.
 */
const ESTAGIOS: Estagio[] = [
  {
    key: "visitas",
    label: "Visitas",
    icon: Eye,
    hint: "crm_acoes · aco_tipocontato = 'Visita', por aco_dthconclusao · NAO exclui REPASSE DE MAQUINA",
  },
  {
    key: "oportunidades",
    label: "Oportunidades no funil VENDAS",
    icon: Target,
    hint: "primeira entrada historica no funil VENDAS no periodo, sem REPASSE DE MAQUINA; Cotacao, Proposta e Pedido continuam sendo oportunidades",
  },
];

/** Razao entre dois degraus — a legenda que da sentido ao numero de cima. */
function Conector({ valor, texto }: { valor: string; texto: string }) {
  return (
    <div className="flex items-center gap-3 pl-6">
      <span className="h-4 w-px bg-[var(--voux-card-border)]" aria-hidden="true" />
      <span
        className="text-sm font-semibold tabular-nums text-[var(--voux-champagne-400)]"
        style={{ fontFamily: MONO }}
      >
        {valor}
      </span>
      <span className="text-[11px] text-[var(--voux-text-muted)]">{texto}</span>
    </div>
  );
}

interface Props {
  funil: AcoesFunil;
  /** `perdidosSemAtribuicao` vem daqui — opcional para nao quebrar chamadas antigas. */
  meta?: AcoesFunilMeta;
  loading?: boolean;
  error?: Error | null;
}

/**
 * Atividade e desfechos do periodo (ex-"Funil de Conversao").
 *
 * O nome mudou porque a medicao desmentiu o desenho: em julho/2026, dos 193
 * negocios tocados, so 111 receberam visita — 96 vieram de telefonema/whatsapp
 * e 30 de "outro". O topo NAO contem a base, entao nunca foi funil. Chamar de
 * funil induzia o gestor a ler queda entre degraus como perda de conversao,
 * quando boa parte e simplesmente canal diferente.
 *
 * Ganhos e Perdidos aparecem como desfechos PARALELOS, cada um com sua fonte e
 * sua data de competencia. Nao ha taxa `ganhos / (ganhos + perdidos)`: as
 * unidades sao diferentes (pedido vs negocio) e as janelas tambem.
 */
export function AcoesFunilConversao({ funil, meta, loading, error }: Props) {
  const { visitasPorOportunidade } = funilRatios(funil);
  const base = funil.visitas;
  const perdidosSemAtribuicao = meta?.perdidosSemAtribuicao ?? 0;

  if (!loading && error) {
    return (
      <section className={CARD} aria-label="Atividade e desfechos do periodo">
        <BiGestaoErro error={error} contexto="a atividade e os desfechos do periodo" />
      </section>
    );
  }

  if (loading) {
    return (
      <div className={CARD}>
        <Skeleton className="mb-4 h-4 w-48 rounded" style={{ background: "var(--voux-skeleton)" }} />
        <div className="space-y-3">
          {[100, 62, 34].map((w) => (
            <Skeleton key={w} className="h-14 rounded-xl" style={{ width: `${w}%`, background: "var(--voux-skeleton)" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className={CARD} aria-label="Atividade e desfechos do periodo">
      <header className="mb-4">
        <h3
          className="text-[15px] font-medium tracking-[-0.01em] text-[var(--voux-text-heading)]"
          style={{ fontFamily: "var(--voux-font-sans)" }}
        >
          Atividade e desfechos do periodo
        </h3>
        <p className="text-[11px] text-[var(--voux-text-faint)]" style={{ fontFamily: MONO, letterSpacing: "0.02em" }}>
          Visitas (acoes) · oportunidades do funil VENDAS · etapa inicial · ganhos (pedidos) · perdas (negocios)
        </p>
      </header>

      <p
        className="mb-4 text-[10px] font-mono tracking-wider opacity-60 bg-champagne-400/[0.08] rounded-lg px-3 py-1.5"
        role="note"
        style={{ fontFamily: MONO, letterSpacing: "0.06em" }}
      >
        {NOTA_PERIODO}
      </p>

      <div className="space-y-2">
        <AcoesDegrauBar icon={ESTAGIOS[0].icon} label={ESTAGIOS[0].label} valor={funil.visitas} base={base} hint={ESTAGIOS[0].hint} />
        <Conector valor={fmtRatio(visitasPorOportunidade)} texto="visitas por oportunidade" />
        <AcoesDegrauBar icon={ESTAGIOS[1].icon} label={ESTAGIOS[1].label} valor={funil.oportunidades} base={base} hint={ESTAGIOS[1].hint} />
        <p className="pl-6 text-[11px] text-[var(--voux-text-muted)]">
          {brl(funil.valorOportunidades)} em oportunidades geradas · {funil.oportunidadesAbertas.toLocaleString("pt-BR")} ainda em aberto ({brl(funil.valorOportunidadesAbertas)})
        </p>
      </div>

      <p className="mt-4 rounded-lg bg-champagne-400/[0.08] px-3 py-2 text-[11px] leading-relaxed text-[var(--voux-text-muted)]">
        <strong className="text-[var(--voux-text-primary)]">Etapa inicial “Oportunidade”:</strong>{" "}
        {funil.entradasEtapaOportunidade.toLocaleString("pt-BR")} negocio(s) entraram em
        {" "}<em>1-OPORTUNIDADE</em> no funil VENDAS; {funil.emEtapaOportunidade.toLocaleString("pt-BR")}
        {" "}seguem em andamento nessa etapa. Cotacao, Proposta ao Cliente e Pedido sao etapas seguintes da mesma oportunidade comercial.
      </p>

      <AcoesDesfechosPeriodo funil={funil} perdidosSemAtribuicao={perdidosSemAtribuicao} />
    </section>
  );
}
