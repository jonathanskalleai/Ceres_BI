import { Eye, Target, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BiGestaoErro } from "@/components/bi/BiGestaoErro";
import { AcoesDesfechosPeriodo } from "@/components/bi/sections/AcoesDesfechosPeriodo";
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
 * TRES datas de competencia diferentes.
 */
const NOTA_PERIODO =
  "Período dos eventos: ações por conclusão, ganhos por aprovação de pedido e perdas por fechamento de negócio.";

interface Estagio {
  key: keyof Pick<AcoesFunil, "visitas" | "oportunidades">;
  label: string;
  icon: typeof Eye;
  hint: string;
}

/**
 * Somente os dois degraus de ATIVIDADE. Ganhos e Perdidos sairam daqui: nao sao
 * degraus abaixo de oportunidade, sao desfechos paralelos com fonte propria.
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
    label: "Oportunidades abertas",
    icon: Target,
    hint: "negocios canonicos tocados por acao no periodo que seguem Em Andamento, sem REPASSE DE MAQUINA",
  },
];

/** Largura relativa do degrau. Piso de 18% para o ultimo estagio nao sumir. */
function larguraPct(valor: number, base: number): number {
  if (base <= 0) return 18;
  return Math.max(18, Math.round((valor / base) * 100));
}

function Degrau({ estagio, valor, base }: { estagio: Estagio; valor: number; base: number }) {
  const Icon = estagio.icon;
  return (
    <div className="flex items-center gap-3" title={estagio.hint}>
      <div
        className="relative flex h-14 items-center rounded-xl px-4 transition-[width] duration-500"
        style={{
          width: `${larguraPct(valor, base)}%`,
          minWidth: 150,
          background: "linear-gradient(90deg, var(--voux-accent) 0%, var(--voux-champagne-400) 100%)",
          opacity: 0.92,
        }}
      >
        <Icon className="h-4 w-4 shrink-0 text-[var(--surface-raised)]" aria-hidden="true" />
        <span
          className="ml-2 text-lg font-semibold tabular-nums text-[var(--surface-raised)]"
          style={{ fontFamily: "var(--voux-font-display)" }}
        >
          {valor.toLocaleString("pt-BR")}
        </span>
        <span
          className="ml-2 truncate text-[10px] uppercase text-[var(--surface-raised)]"
          style={{ fontFamily: MONO, letterSpacing: "0.22em", opacity: 0.85 }}
        >
          {estagio.label}
        </span>
      </div>
    </div>
  );
}

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
  const { visitasPorOportunidade, oportPorFechamento } = funilRatios(funil);
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
          Visitas e oportunidades (acoes) · ganhos (pedidos) · perdas (negocios)
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
        <Degrau estagio={ESTAGIOS[0]} valor={funil.visitas} base={base} />
        <Conector valor={fmtRatio(visitasPorOportunidade)} texto="visitas por oportunidade aberta" />
        <Degrau estagio={ESTAGIOS[1]} valor={funil.oportunidades} base={base} />
        <p className="pl-6 text-[11px] text-[var(--voux-text-muted)]">
          {brl(funil.valorOportunidades)} em negociacao aberta
        </p>
      </div>

      <AcoesDesfechosPeriodo funil={funil} perdidosSemAtribuicao={perdidosSemAtribuicao} />

      <footer className="mt-4 flex items-start gap-2 border-t border-[var(--voux-card-border)] pt-3">
        <Info className="mt-[2px] h-3.5 w-3.5 shrink-0 text-[var(--voux-text-muted)]" aria-hidden="true" />
        <div className="space-y-1.5 text-[11px] leading-relaxed text-[var(--voux-text-muted)]">
          <p>
            <strong className="text-[var(--voux-text-primary)]">Nao e funil:</strong> ganho e perda sao
            desfechos <em>paralelos</em>, medidos em fontes e datas diferentes. Um ganho deste mes pode vir de
            uma acao do ano passado. Por isso a tela nao calcula taxa de conversao entre eles — o resultado
            seria um numero certo respondendo a pergunta errada.
          </p>
          <p>
            <strong className="text-[var(--voux-text-primary)]">Oportunidades e um ESTADO, nao um evento:</strong>{" "}
            conta o que foi tocado no periodo e <em>segue</em> Em Andamento. Um mes ja fechado diminui quando um
            negocio dele for concluido depois. Isso e a definicao funcionando, nao falha de carga.
          </p>
          <p>
            <strong className="text-[var(--voux-text-primary)]">O filtro "Tipo de Acao" afeta so visitas e
            oportunidades.</strong> Pedido e negocio nao tem tipo de acao: ganhos e perdas permanecem iguais ao
            trocar esse filtro.
          </p>
          <p>
            <strong className="text-[var(--voux-text-primary)]">Indice de janela</strong> (nao e taxa de
            conversao): {fmtRatio(oportPorFechamento)} oportunidades abertas para cada pedido aprovado no
            periodo. O ciclo de venda de maquina agricola leva 6 a 18 meses, entao a oportunidade aberta agora
            ainda nao teve chance de fechar — o numero so e comparavel{" "}
            <strong className="text-[var(--voux-text-primary)]">entre consultores</strong>, nunca em valor
            absoluto. Sem denominador, aparece “—”: divisao por zero e ausencia de dado, nao zero.
          </p>
        </div>
      </footer>
    </section>
  );
}
