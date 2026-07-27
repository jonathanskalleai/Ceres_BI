import { ClipboardList, MapPin, Users, Eye, UserCheck, Tag, Clock, Wallet, Trophy, XCircle, AlertTriangle, Target, Gauge, PauseCircle } from "lucide-react";
import { KPICard } from "@/components/bi/KPICard";
import { calcTrend } from "@/lib/dateUtils";
import { funilRatios, fmtRatio, DASH } from "@/lib/bi/acoesGestaoUtils";
import type { AcoesBIKpis, AcoesDiasParados, AcoesFunil } from "@/types/biRpc";

/**
 * Semantica compartilhada pelos 3 cards de valor. Explicita de proposito:
 * `ngo_conclusao` e o status ATUAL do negocio, nao o status na data da acao —
 * um negocio trabalhado em maio e perdido em junho conta como Perdido em maio.
 */
const VALOR_BASE =
  "mirror.crm_negocios · SUM(ngo_vlrtotalnegociado) dedup por ngo_numero · negocios TOCADOS por acao no periodo (aco_dthconclusao) · funis VENDAS/Vendas AP/REPASSE DE MAQUINA · status ATUAL do negocio (ngo_conclusao), nao o status na data da acao";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

const num = (v: number) => v.toLocaleString("pt-BR");

interface Props {
  kpis: AcoesBIKpis;
  kpisPrev: AcoesBIKpis;
  loading?: boolean;
  /**
   * Numeros de gestao (rpc_acoes_funil_gestao). Absorvidos NESTA faixa de KPI
   * de proposito: uma segunda faixa logo abaixo empurraria os graficos para
   * fora da dobra e ninguem leria nem uma nem outra.
   */
  funil?: AcoesFunil;
  diasParados?: AcoesDiasParados;
  gestaoLoading?: boolean;
}

/**
 * KPIs de gestao comercial (pedido 7 + E6).
 *
 * `diasParados` usa MEDIANA, nao media: a distribuicao tem cauda longa e a
 * media seria puxada por negocios abandonados ha anos. E o unico indicador da
 * tela que aponta receita JA levantada e parada.
 */
function GestaoKpis({ funil, diasParados, loading }: { funil?: AcoesFunil; diasParados?: AcoesDiasParados; loading?: boolean }) {
  const ratios = funil ? funilRatios(funil) : null;
  const mediana = diasParados?.mediana;

  return (
    <>
      <KPICard
        title="Oportunidades Levantadas"
        value={funil ? num(funil.oportunidades) : DASH}
        icon={Target}
        loading={loading}
        hint={funil ? `${num(funil.ganhos)} fechadas ate agora` : undefined}
        formula="Quantos negocios comerciais distintos foram trabalhados (tiveram pelo menos 1 acao registrada) no periodo selecionado"
        dataSource="rpc_acoes_funil_gestao · negocios comerciais DISTINTOS tocados por acao no periodo (dedup por ngo_numero)" />

      <KPICard
        title="Visitas por Oportunidade"
        value={fmtRatio(ratios?.visitasPorOportunidade ?? null)}
        icon={Gauge}
        loading={loading}
        hint="quanto esforco custa levantar 1 negocio"
        formula="Quantas visitas presenciais foram necessarias, em media, para gerar cada oportunidade de negocio no periodo"
        dataSource="rpc_acoes_funil_gestao · visitas / oportunidades no periodo · '—' quando nao ha oportunidade (divisao por zero, nao zero)" />

      <KPICard
        title="Dias Parados (mediana)"
        value={mediana != null ? `${num(mediana)} dias` : DASH}
        icon={PauseCircle}
        loading={loading}
        hint={diasParados ? `${num(diasParados.negociosAbertos)} negocios abertos` : undefined}
        formula="Metade dos negocios em andamento esta sem contato ha mais dias que este numero, e metade ha menos. Mediana alta = carteira esfriando"
        dataSource="rpc_acoes_funil_gestao · MEDIANA de dias desde a ultima acao em negocio comercial 'Em Andamento' — mediana, nao media: a distribuicao tem cauda longa" />
    </>
  );
}

/**
 * Aviso de 4o status em `ngo_conclusao`.
 *
 * A RPC quebra o valor tocado em Em Andamento / Ganho / Perdido — os 3 valores
 * que existem hoje. Se o ERP introduzir um quarto, os negocios dele nao entram
 * em nenhum dos 3 cards e a soma passa a ser MENOR que o real, em silencio.
 * `negociosOutrosStatus` existe para isso; este bloco e o que faz alguem ficar
 * sabendo. Detector que ninguem le nao detecta nada.
 */
function StatusDesconhecidoAlert({ kpis }: { kpis: AcoesBIKpis }) {
  if (kpis.negociosOutrosStatus <= 0) return null;

  const somaCards = kpis.valorAberto + kpis.valorGanho + kpis.valorPerdido;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-[var(--voux-danger)]/40 bg-[var(--voux-danger)]/[0.06] p-3 text-xs"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--voux-danger)]" aria-hidden="true" />
      <p className="text-[var(--voux-text-primary)]">
        <span className="font-medium">
          {num(kpis.negociosOutrosStatus)} negocio(s) com status fora de Em Andamento/Ganho/Perdido.
        </span>{" "}
        Os cards abaixo somam {brl(somaCards)} de um total tocado de {brl(kpis.valorTocado)} — a diferenca
        esta num status que a tela ainda nao tem card. Avise o time de dados.
      </p>
    </div>
  );
}

/** Grid de KPIs da tela /bi/acoes — extraida de AcoesSection para conter o tamanho do arquivo. */
export function AcoesKpiGrid({ kpis, kpisPrev, loading, funil, diasParados, gestaoLoading }: Props) {
  return (
    <div className="space-y-4">
      <StatusDesconhecidoAlert kpis={kpis} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <KPICard title="Total de Acoes" value={num(kpis.totalAcoes)} icon={ClipboardList} loading={loading}
        previousValue={num(kpisPrev.totalAcoes)} trend={calcTrend(kpis.totalAcoes, kpisPrev.totalAcoes)}
        formula="Total de acoes comerciais concluidas no periodo, independente do tipo de contato (visita, telefone, email, etc.)"
        dataSource="mirror.crm_acoes · COUNT(*) por aco_dthconclusao" />

      <KPICard title="Cidades Atendidas" value={num(kpis.cidades)} icon={MapPin} loading={loading}
        previousValue={num(kpisPrev.cidades)} trend={calcTrend(kpis.cidades, kpisPrev.cidades)}
        formula="Quantas cidades diferentes tiveram clientes atendidos no periodo. Usa a cidade do cliente, nao da filial"
        dataSource="COUNT(DISTINCT cli_cidade) — cidade do CLIENTE (crm_carteira_clientes), nao da filial" />

      <KPICard title="Consultores Ativos" value={num(kpis.consultores)} icon={Users} loading={loading}
        previousValue={num(kpisPrev.consultores)} trend={calcTrend(kpis.consultores, kpisPrev.consultores)}
        formula="Quantos vendedores/consultores registraram pelo menos 1 acao concluida no periodo selecionado"
        dataSource="mirror.crm_acoes · COUNT(DISTINCT aco_vendedor)" />

      <KPICard title="Total de Visitas" value={num(kpis.visitas)} icon={Eye} loading={loading}
        previousValue={num(kpisPrev.visitas)} trend={calcTrend(kpis.visitas, kpisPrev.visitas)}
        formula="Quantidade de acoes do tipo 'visita' (presencial) registradas no periodo. Um mesmo cliente visitado 3 vezes conta 3"
        dataSource="mirror.crm_acoes · COUNT(*) WHERE aco_tipocontato LIKE '%visita%'" />

      <KPICard title="Clientes Unicos" value={num(kpis.clientes)} icon={UserCheck} loading={loading}
        previousValue={num(kpisPrev.clientes)} trend={calcTrend(kpis.clientes, kpisPrev.clientes)}
        formula="Quantos clientes diferentes receberam pelo menos 1 acao (qualquer tipo de contato) no periodo. Cada cliente conta 1 vez"
        dataSource="mirror.crm_acoes · COUNT(DISTINCT cli_nome)" />

      <KPICard title="Tipos de Acao" value={num(kpis.tiposAcaoDistintos)} icon={Tag} loading={loading}
        previousValue={num(kpisPrev.tiposAcaoDistintos)} trend={calcTrend(kpis.tiposAcaoDistintos, kpisPrev.tiposAcaoDistintos)}
        formula="Quantos tipos de acao diferentes (ex: Prospeccao, Pos-Vendas, Cobranca) foram registrados no periodo. Mostra a diversidade do trabalho comercial"
        dataSource="mirror.crm_acoes · COUNT(DISTINCT aco_tipoacao)" />

      <KPICard title="Duracao Media da Acao" value={`${kpis.tempoMedioContato} dias`} icon={Clock} loading={loading}
        previousValue={`${kpisPrev.tempoMedioContato} dias`} trend={calcTrend(kpis.tempoMedioContato, kpisPrev.tempoMedioContato)}
        invertTrend
        formula="Tempo medio em dias entre a abertura e a conclusao de uma acao. Mede quanto tempo o consultor leva para finalizar cada acao, nao o tempo ate o primeiro contato"
        dataSource="mirror.crm_acoes · AVG(aco_dthconclusao - aco_dthabertura) em dias — duracao da propria acao (abertura ate conclusao), NAO tempo ate o primeiro contato" />

      <KPICard title="Valor em Aberto" value={brl(kpis.valorAberto)} icon={Wallet} loading={loading}
        previousValue={brl(kpisPrev.valorAberto)} trend={calcTrend(kpis.valorAberto, kpisPrev.valorAberto)}
        rawValue={kpis.valorAberto}
        hint={`${num(kpis.negociosAberto)} negocios`}
        formula="Soma do valor dos negocios que ainda estao Em Andamento e foram trabalhados (tiveram acao) no periodo. Receita potencial em jogo"
        dataSource={`${VALOR_BASE} · recorte: Em Andamento`} />

      <KPICard title="Valor Ganho" value={brl(kpis.valorGanho)} icon={Trophy} loading={loading}
        previousValue={brl(kpisPrev.valorGanho)} trend={calcTrend(kpis.valorGanho, kpisPrev.valorGanho)}
        rawValue={kpis.valorGanho}
        hint={`${num(kpis.negociosGanho)} negocios`}
        formula="Soma do valor dos negocios ja fechados (ganhos) que foram trabalhados no periodo. Receita efetivamente convertida"
        dataSource={`${VALOR_BASE} · recorte: Ganho`} />

      <KPICard title="Valor Perdido" value={brl(kpis.valorPerdido)} icon={XCircle} loading={loading}
        previousValue={brl(kpisPrev.valorPerdido)} trend={calcTrend(kpis.valorPerdido, kpisPrev.valorPerdido)} invertTrend
        rawValue={kpis.valorPerdido}
        hint={`${num(kpis.negociosPerdido)} negocios`}
        formula="Soma do valor dos negocios perdidos que foram trabalhados no periodo. Receita que escapou — quanto menor, melhor"
        dataSource={`${VALOR_BASE} · recorte: Perdido`} />

      <GestaoKpis funil={funil} diasParados={diasParados} loading={gestaoLoading} />
      </div>
    </div>
  );
}
