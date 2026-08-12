import type { RpcConsultorResumoAcoes } from "@/types/consultoresRpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBRL, formatDateBR } from "@/lib/dateUtils";
import { BadgeCheck, CalendarDays } from "lucide-react";

interface ConsultoresValidationTableProps {
  resumo: RpcConsultorResumoAcoes[];
  from: string;
  to: string;
  onSelectConsultor: (consultor: string) => void;
}

function formatRate(value: number | null): string {
  return value == null ? "—" : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

/**
 * Quadro auditavel do periodo selecionado. Cada coluna usa a mesma fonte e
 * regra da tela Acoes; valores nunca sao derivados da lista de acoes no browser.
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
      acoes: 0,
      visitas: 0,
      negociosAbertos: 0,
      carteira: 0,
      oportunidadesAbertas: 0,
      pipelineAberto: 0,
      ganhos: 0,
      valorGanho: 0,
      perdidos: 0,
      valorPerdido: 0,
      oportunidadesGeradas: 0,
    },
  );
  const taxaTotal = totais.oportunidadesGeradas > 0
    ? totais.ganhos * 100 / totais.oportunidadesGeradas
    : null;

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardHeader className="gap-2 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Ranking e conferência por consultor</CardTitle>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDateBR(from)} a {formatDateBR(to)}
          </span>
        </div>
        <CardDescription>
          Posição por vendas, depois visitas e ações. Todos os consultores cadastrados como Vendas aparecem, inclusive com zero no período.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <Table className="min-w-[1180px] text-xs">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16 px-6 text-right">Pos.</TableHead>
              <TableHead className="min-w-56">Consultor</TableHead>
              <TableHead className="text-right">Vendas</TableHead>
              <TableHead className="text-right">Visitas</TableHead>
              <TableHead className="text-right">Ações</TableHead>
              <TableHead className="text-right">Pipeline em aberto</TableHead>
              <TableHead className="text-right">Carteira ativa trabalhada</TableHead>
              <TableHead className="text-right">Perdidos</TableHead>
              <TableHead className="text-right">Conversão</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranking.map((item, index) => (
              <TableRow key={item.consultor} className="cursor-pointer" onClick={() => onSelectConsultor(item.consultor)}>
                <TableCell className="px-6 text-right font-semibold tabular-nums">{index + 1}</TableCell>
                <TableCell className="font-medium">{item.consultor}</TableCell>
                <TableCell className="text-right tabular-nums">
                  <div>{formatBRL(Number(item.valor_ganho))}</div>
                  <span className="text-[10px] text-muted-foreground">{item.ganhos} ganhos aprovados</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{item.visitas}</TableCell>
                <TableCell className="text-right tabular-nums">{item.acoes}</TableCell>
                <TableCell className="text-right tabular-nums">
                  <div>{formatBRL(Number(item.pipeline_aberto_gerado))}</div>
                  <span className="text-[10px] text-muted-foreground">{item.oportunidades_abertas} oportunidades abertas</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <div>{formatBRL(Number(item.carteira_ativa_trabalhada))}</div>
                  <span className="text-[10px] text-muted-foreground">{item.negocios_abertos_tocados} abertos tocados</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <div>{formatBRL(Number(item.valor_perdido))}</div>
                  <span className="text-[10px] text-muted-foreground">{item.perdidos} negócios</span>
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatRate(item.taxa_ganho)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell className="px-6 text-right">—</TableCell>
              <TableCell className="font-semibold">Total</TableCell>
              <TableCell className="text-right tabular-nums">
                <div>{formatBRL(totais.valorGanho)}</div>
                <span className="text-[10px] text-muted-foreground">{totais.ganhos} ganhos aprovados</span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{totais.visitas}</TableCell>
              <TableCell className="text-right tabular-nums">{totais.acoes}</TableCell>
              <TableCell className="text-right tabular-nums">
                <div>{formatBRL(totais.pipelineAberto)}</div>
                <span className="text-[10px] text-muted-foreground">{totais.oportunidadesAbertas} oportunidades abertas</span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <div>{formatBRL(totais.carteira)}</div>
                <span className="text-[10px] text-muted-foreground">{totais.negociosAbertos} abertos tocados</span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <div>{formatBRL(totais.valorPerdido)}</div>
                <span className="text-[10px] text-muted-foreground">{totais.perdidos} negócios</span>
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{formatRate(taxaTotal)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
      <div className="border-t px-6 py-3 text-[11px] text-muted-foreground">
        Repasse de Máquina não entra em carteira, pipeline, ganhos, perdas ou conversão. Conversão = ganhos aprovados ÷ oportunidades que entraram em Vendas no período; “—” significa que não houve oportunidade no denominador.
      </div>
    </Card>
  );
}
