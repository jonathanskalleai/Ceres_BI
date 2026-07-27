import { Eye, Target, Trophy, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BiGestaoErro } from "@/components/bi/BiGestaoErro";
import { funilRatios, fmtRatio } from "@/lib/bi/acoesGestaoUtils";
import type { AcoesFunil } from "@/types/biRpc";

const CARD =
  "rounded-2xl border border-[var(--voux-card-border)] bg-[var(--surface-raised)] p-5 shadow-[var(--voux-card-shadow)]";

const MONO = "var(--voux-font-mono)";

interface Estagio {
  key: keyof Pick<AcoesFunil, "visitas" | "oportunidades" | "ganhos">;
  label: string;
  icon: typeof Eye;
  hint: string;
}

const ESTAGIOS: Estagio[] = [
  { key: "visitas", label: "Visitas", icon: Eye, hint: "crm_acoes · aco_tipocontato = 'Visita' no periodo" },
  { key: "oportunidades", label: "Oportunidades", icon: Target, hint: "negocios comerciais DISTINTOS tocados por acao no periodo" },
  { key: "ganhos", label: "Fechamentos", icon: Trophy, hint: "desses, ngo_conclusao = 'Ganho' (status ATUAL do negocio)" },
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
  loading?: boolean;
  error?: Error | null;
}

/**
 * Funil de conversao visita -> oportunidade -> fechamento (pedidos 1 e 2).
 *
 * Um card solto com "5,56" nao diz nada sem o denominador ao lado: por isso as
 * duas razoes sao LEGENDA ENTRE os degraus, nao cards separados.
 *
 * A legenda de janela (E6) e obrigatoria e nao e decorativa: "13,77
 * oportunidades por fechamento" NAO e taxa de conversao — o ciclo de venda de
 * maquina agricola e 6-18 meses, entao a oportunidade aberta neste ano ainda
 * nao teve chance de fechar. Sem essa frase o gestor decide errado com um
 * numero certo, que e o pior desfecho possivel de um BI.
 */
export function AcoesFunilConversao({ funil, loading, error }: Props) {
  const { visitasPorOportunidade, oportPorFechamento } = funilRatios(funil);
  const base = funil.visitas;

  if (!loading && error) {
    return (
      <section className={CARD} aria-label="Funil de conversao comercial">
        <BiGestaoErro error={error} contexto="o funil de conversao" />
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
    <section className={CARD} aria-label="Funil de conversao comercial">
      <header className="mb-4">
        <h3
          className="text-[15px] font-medium tracking-[-0.01em] text-[var(--voux-text-heading)]"
          style={{ fontFamily: "var(--voux-font-sans)" }}
        >
          Funil de Conversao
        </h3>
        <p className="text-[11px] text-[var(--voux-text-faint)]" style={{ fontFamily: MONO, letterSpacing: "0.02em" }}>
          Visita → oportunidade → fechamento · periodo filtrado
        </p>
      </header>

      <p
        className="mb-4 text-[10px] font-mono tracking-wider opacity-60 bg-champagne-400/[0.08] rounded-lg px-3 py-1.5"
        role="note"
        style={{ fontFamily: MONO, letterSpacing: "0.06em" }}
      >
        Ganhos = negocios com status atual &quot;Ganho&quot; tocados no periodo. Nao significa que fecharam neste periodo.
      </p>

      <div className="space-y-2">
        <Degrau estagio={ESTAGIOS[0]} valor={funil.visitas} base={base} />
        <Conector valor={fmtRatio(visitasPorOportunidade)} texto="visitas por oportunidade levantada" />
        <Degrau estagio={ESTAGIOS[1]} valor={funil.oportunidades} base={base} />
        <Conector valor={fmtRatio(oportPorFechamento)} texto="oportunidades por fechamento" />
        <Degrau estagio={ESTAGIOS[2]} valor={funil.ganhos} base={base} />
      </div>

      <footer className="mt-4 flex items-start gap-2 border-t border-[var(--voux-card-border)] pt-3">
        <Info className="mt-[2px] h-3.5 w-3.5 shrink-0 text-[var(--voux-text-muted)]" aria-hidden="true" />
        <p className="text-[11px] leading-relaxed text-[var(--voux-text-muted)]">
          <strong className="text-[var(--voux-text-primary)]">Como ler:</strong> oportunidades por fechamento{" "}
          <em>nao</em> e taxa de conversao — e artefato de janela. O ciclo de venda de maquina agricola leva
          6 a 18 meses, entao a oportunidade aberta neste periodo ainda nao teve chance de fechar. O numero so
          e comparavel <strong className="text-[var(--voux-text-primary)]">entre consultores</strong>, nunca em
          valor absoluto. Alem disso, <code>ngo_conclusao</code> e o status <strong>atual</strong> do negocio:
          um Ganho de 2024 tocado por uma acao neste periodo conta aqui. Sem oportunidade (ou sem ganho) no
          periodo, a razao aparece como “—” — divisao por zero e ausencia de dado, nao zero.
        </p>
      </footer>
    </section>
  );
}
