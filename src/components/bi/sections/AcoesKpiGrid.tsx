import { Briefcase, ClipboardList, MapPin, Users, Eye, UserCheck, Percent, Clock, Trophy, XCircle, AlertTriangle, Target, Gauge, PauseCircle } from "lucide-react";
import { KPICard } from "@/components/bi/KPICard";
import { calcTrend } from "@/lib/dateUtils";
import { funilRatios, fmtRatio, DASH } from "@/lib/bi/acoesGestaoUtils";
import type { AcoesBIKpis, AcoesDiasParados, AcoesFunil } from "@/types/biRpc";

/**
 * NAO existe mais uma "base compartilhada" entre os cards de valor (v9).
 *
 * Ganho e Perdido medem coisas diferentes, em unidades diferentes, com datas de
 * competencia diferentes — sao DESFECHOS PARALELOS, nao fatias do mesmo bolo.
 * Por isso cada card carrega a sua propria fonte, e a tela NAO soma um com o
 * outro em lugar nenhum: R$ de pedido faturado + R$ negociado potencial seria
 * um numero sem significado.
 */
const GANHO_SOURCE =
  "mirror.crm_pedidos · SUM(pdo_vlrpedido) dedup por pdo_codigointerno · pdo_situacaopedido='Aprovado' · data de competencia: pdo_dthaprovacao · negocio canonico com ngo_conclusao='Ganho' e ngo_funil <> 'REPASSE DE MAQUINA'";

const PERDIDO_SOURCE =
  "mirror.crm_negocios canonizado por ngo_numero · SUM(ngo_vlrtotalnegociado) · ngo_conclusao='Perdido' · data de competencia: ngo_datafechamento · ngo_funil <> 'REPASSE DE MAQUINA' · nenhum pedido alimenta este card";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

const num = (v: number) => v.toLocaleString("pt-BR");

interface Props {
  kpis: AcoesBIKpis;
  kpisPrev: AcoesBIKpis;
  loading?: boolean;
  /** Números de coorte, pipeline e carteira da RPC de gestão do período. */
  funil?: AcoesFunil;
  funilPrev?: AcoesFunil;
  diasParados?: AcoesDiasParados;
  gestaoLoading?: boolean;
  onOpenDiasSemAcao?: () => void;
}

/**
 * Indice operacional: ganhos do periodo sobre as oportunidades que entraram
 * no funil VENDAS no mesmo periodo. Perdas nao fazem parte do denominador.
 */
function taxaDeGanho(funil?: AcoesFunil): number | null {
  if (!funil || funil.oportunidades <= 0) return null;
  return Math.round((funil.ganhos * 1000) / funil.oportunidades) / 10;
}

/**
 * KPIs de gestao comercial (pedido 7 + E6).
 *
 * `diasParados` usa MEDIANA, nao media: a distribuicao tem cauda longa e a
 * media seria puxada por negocios abandonados ha anos. E o unico indicador da
 * tela que aponta receita JA levantada e parada.
 */
function OportunidadesKpis({
  funil,
  loading,
  taxaGanho,
  taxaGanhoPrev,
}: {
  funil?: AcoesFunil;
  loading?: boolean;
  taxaGanho: number | null;
  taxaGanhoPrev: number | null;
}) {
  const ratios = funil ? funilRatios(funil) : null;

  return (
    <>
      <KPICard
        title="Oportunidades Geradas no Período"
        value={funil ? num(funil.oportunidades) : DASH}
        icon={Target}
        loading={loading}
        hint={funil
          ? `${num(funil.oportunidadesAbertas)} ainda estão abertas`
          : undefined}
        formula="Negócios cuja primeira entrada histórica no funil VENDAS ocorreu no período. O resumo indica quantos deles continuam Em Andamento; ganhos e perdidos aparecem nos respectivos cards próprios."
        dataSource="mirror.crm_funil_etapa · primeira entrada em funil_dsc='VENDAS' por fne_dthinicioetapa · exclui REPASSE DE MAQUINA" />

      <KPICard
        title="Pipeline Aberto no Período"
        value={funil ? brl(funil.valorOportunidadesAbertas) : DASH}
        rawValue={funil?.valorOportunidadesAbertas}
        icon={Briefcase}
        loading={loading}
        hint={funil
          ? `${num(funil.oportunidadesAbertas)} das ${num(funil.oportunidades)} oportunidades geradas ainda estão abertas`
          : undefined}
        formula="Soma apenas das oportunidades geradas no período selecionado que continuam Em Andamento. Não inclui oportunidades antigas, mesmo quando continuam sendo trabalhadas agora."
        dataSource="primeira entrada em VENDAS no período + ngo_conclusao='Em Andamento' · SUM(ngo_vlrtotalnegociado) · sem REPASSE DE MAQUINA" />

      <KPICard
        title="Ganho sobre Oportunidades"
        value={taxaGanho != null ? `${taxaGanho.toFixed(1)}%` : DASH}
        icon={Percent}
        loading={loading}
        previousValue={taxaGanhoPrev != null ? `${taxaGanhoPrev.toFixed(1)}%` : undefined}
        trend={taxaGanho != null && taxaGanhoPrev != null
          ? calcTrend(taxaGanho, taxaGanhoPrev)
          : undefined}
        hint={funil ? `${num(funil.ganhos)} ganhos sobre ${num(funil.oportunidades)} oportunidades geradas` : undefined}
        formula="Ganhos do período / oportunidades que entraram no funil VENDAS no mesmo período. Perdidos não entram no denominador."
        dataSource="pedidos aprovados ganhos / primeira entrada no funil VENDAS" />

      <KPICard
        title="Visitas por Oportunidade"
        value={fmtRatio(ratios?.visitasPorOportunidade ?? null)}
        icon={Gauge}
        loading={loading}
        hint="quanto esforco custa gerar 1 oportunidade"
        formula="Quantas visitas presenciais foram registradas, em media, para cada negocio que entrou no funil VENDAS no periodo. A etapa CRM 'OPORTUNIDADE' e apenas uma das etapas desse funil."
        dataSource="rpc_acoes_funil_gestao_periodo · visitas / primeira entrada no funil VENDAS · '—' quando nao ha oportunidade (divisao por zero, nao zero)" />
    </>
  );
}

function CarteiraKpis({
  funil, diasParados, loading, onOpenDiasSemAcao,
}: {
  funil?: AcoesFunil;
  diasParados?: AcoesDiasParados;
  loading?: boolean;
  onOpenDiasSemAcao?: () => void;
}) {
  const mediana = diasParados?.mediana;
  return (
    <>
      <KPICard
        title="Carteira Ativa Trabalhada"
        value={funil ? brl(funil.valorPipelineAbertoTocadoNoPeriodo) : DASH}
        rawValue={funil?.valorPipelineAbertoTocadoNoPeriodo}
        icon={Briefcase}
        loading={loading}
        hint={funil
          ? `${num(funil.negociosAbertosTocadosNoPeriodo)} negócios em andamento com ação no período`
          : undefined}
        formula="Carteira operacional: negócios que continuam Em Andamento e tiveram ao menos uma ação concluída no período. Diferente do pipeline gerado no período, inclui negociações abertas em meses anteriores. Não é usado na taxa de ganho."
        dataSource="crm_acoes + crm_negocios canônico · ação concluída no período + ngo_conclusao='Em Andamento' · sem REPASSE DE MAQUINA" />

      <KPICard
        title="Dias sem Ação — Carteira Total"
        value={mediana != null ? `${num(mediana)} dias` : DASH}
        icon={PauseCircle}
        loading={loading}
        hint={diasParados ? "Duplo clique para ver alertas e detalhes da carteira" : undefined}
        formula="Metade dos negócios abertos de toda a carteira comercial está sem contato há mais dias que este número, e metade há menos. Não é limitado às oportunidades criadas ou trabalhadas no período."
        dataSource="MEDIANA de dias desde a última ação em negócio comercial Em Andamento; carteira total, não a coorte do calendário"
        onDoubleClick={mediana != null ? onOpenDiasSemAcao : undefined} />
    </>
  );
}

/**
 * Aviso de 4o status em `ngo_conclusao`.
 *
 * O card "Valor Perdido" passou a depender INTEIRAMENTE de
 * `ngo_conclusao = 'Perdido'` (v9). Se o ERP introduzir um quarto status, os
 * negocios dele deixam de aparecer em qualquer card e o Perdido encolhe em
 * silencio — sem nada na tela indicando que faltou gente.
 *
 * Este detector NAO soma cards: Ganho (R$ de pedido) e Perdido (R$ negociado)
 * sao reguas diferentes, e a versao anterior deste alerta comparava justamente
 * a soma dos tres com um `valorTocado` que nem existe mais. O que ele afirma
 * agora e so o que ele consegue medir: existe negocio fechado na janela com um
 * status que a tela nao representa.
 */
function StatusDesconhecidoAlert({ kpis }: { kpis: AcoesBIKpis }) {
  if (kpis.negociosOutrosStatus <= 0) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-[var(--voux-danger)]/40 bg-[var(--voux-danger)]/[0.06] p-3 text-xs"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--voux-danger)]" aria-hidden="true" />
      <p className="text-[var(--voux-text-primary)]">
        <span className="font-medium">
          {num(kpis.negociosOutrosStatus)} negocio(s) fecharam no periodo com status fora de Em
          Andamento/Ganho/Perdido.
        </span>{" "}
        Eles nao entram em nenhum card desta tela — nem em Ganho, nem em Perdido. Existe um 4o status de
        negocio no ERP que o BI ainda nao representa. Avise o time de dados.
      </p>
    </div>
  );
}

/** Grid de KPIs da tela /bi/acoes — extraida de AcoesSection para conter o tamanho do arquivo. */
export function AcoesKpiGrid({
  kpis, kpisPrev, loading, funil, diasParados, gestaoLoading, onOpenDiasSemAcao,
  funilPrev,
}: Props) {
  const taxaGanho = taxaDeGanho(funil);
  const taxaGanhoPrev = taxaDeGanho(funilPrev);

  return (
    <div className="space-y-4">
      <StatusDesconhecidoAlert kpis={kpis} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <KPICard title="Total de Acoes" value={num(kpis.totalAcoes)} icon={ClipboardList} loading={loading}
        previousValue={num(kpisPrev.totalAcoes)} trend={calcTrend(kpis.totalAcoes, kpisPrev.totalAcoes)}
        formula="Total de acoes comerciais concluidas no periodo, independente do tipo de contato (visita, telefone, email, etc.)"
        dataSource="mirror.crm_acoes · COUNT(*) por aco_dthconclusao" />

      <KPICard title="Total de Visitas" value={num(kpis.visitas)} icon={Eye} loading={loading}
        previousValue={num(kpisPrev.visitas)} trend={calcTrend(kpis.visitas, kpisPrev.visitas)}
        formula="Quantidade de acoes do tipo 'visita' (presencial) registradas no periodo. Um mesmo cliente visitado 3 vezes conta 3"
        dataSource="mirror.crm_acoes · COUNT(*) WHERE aco_tipocontato LIKE '%visita%'" />

      <KPICard title="Cidades Atendidas" value={num(kpis.cidades)} icon={MapPin} loading={loading}
        previousValue={num(kpisPrev.cidades)} trend={calcTrend(kpis.cidades, kpisPrev.cidades)}
        formula="Quantas cidades diferentes tiveram clientes atendidos no periodo. Usa a cidade do cliente, nao da filial"
        dataSource="COUNT(DISTINCT cli_cidade) — cidade do CLIENTE (crm_carteira_clientes), nao da filial" />

      <KPICard title="Clientes Unicos" value={num(kpis.clientes)} icon={UserCheck} loading={loading}
        previousValue={num(kpisPrev.clientes)} trend={calcTrend(kpis.clientes, kpisPrev.clientes)}
        formula="Quantos clientes diferentes receberam pelo menos 1 acao (qualquer tipo de contato) no periodo. Cada cliente conta 1 vez"
        dataSource="mirror.crm_acoes · COUNT(DISTINCT cli_nome)" />

      <KPICard title="Consultores Ativos" value={num(kpis.consultores)} icon={Users} loading={loading}
        previousValue={num(kpisPrev.consultores)} trend={calcTrend(kpis.consultores, kpisPrev.consultores)}
        formula="Quantos vendedores/consultores registraram pelo menos 1 acao concluida no periodo selecionado"
        dataSource="mirror.crm_acoes · COUNT(DISTINCT aco_vendedor)" />

      <KPICard title="Duracao Media da Acao" value={`${kpis.tempoMedioContato} dias`} icon={Clock} loading={loading}
        previousValue={`${kpisPrev.tempoMedioContato} dias`} trend={calcTrend(kpis.tempoMedioContato, kpisPrev.tempoMedioContato)}
        invertTrend
        formula="Tempo medio em dias entre a abertura e a conclusao de uma acao. Mede quanto tempo o consultor leva para finalizar cada acao, nao o tempo ate o primeiro contato"
        dataSource="mirror.crm_acoes · AVG(aco_dthconclusao - aco_dthabertura) em dias — duracao da propria acao (abertura ate conclusao), NAO tempo ate o primeiro contato" />

      <OportunidadesKpis funil={funil} loading={gestaoLoading} taxaGanho={taxaGanho} taxaGanhoPrev={taxaGanhoPrev} />

      <KPICard title="Valor Ganho" value={brl(kpis.valorGanho)} icon={Trophy} loading={loading}
        previousValue={brl(kpisPrev.valorGanho)} trend={calcTrend(kpis.valorGanho, kpisPrev.valorGanho)}
        rawValue={kpis.valorGanho}
        hint={`${num(kpis.negociosGanho)} pedidos aprovados`}
        formula="Soma em R$ dos PEDIDOS aprovados no periodo, contados pela data de aprovacao do pedido, cujo negocio esta Ganho. E receita de pedido faturavel — regua DIFERENTE da do card Valor Perdido, que mede valor negociado. Os dois nao se somam"
        dataSource={GANHO_SOURCE} />

      <KPICard title="Valor Perdido" value={brl(kpis.valorPerdido)} icon={XCircle} loading={loading}
        previousValue={brl(kpisPrev.valorPerdido)} trend={calcTrend(kpis.valorPerdido, kpisPrev.valorPerdido)} invertTrend
        rawValue={kpis.valorPerdido}
        hint={`${num(kpis.negociosPerdido)} negocios`}
        formula="Valor POTENCIAL dos negocios marcados como Perdido que fecharam no periodo, contados pela data de fechamento do negocio. E o que estava negociado e nao virou venda — nao e pedido cancelado, e nao se soma ao Valor Ganho"
        dataSource={PERDIDO_SOURCE} />

      <CarteiraKpis
        funil={funil}
        diasParados={diasParados}
        loading={gestaoLoading}
        onOpenDiasSemAcao={onOpenDiasSemAcao}
      />
      </div>
    </div>
  );
}
