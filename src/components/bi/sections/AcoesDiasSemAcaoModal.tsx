import { useMemo } from "react";
import { AcoesEmAndamentoTable } from "@/components/bi/AcoesEmAndamentoTable";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEmAndamentoRpc } from "@/hooks/bi/useEmAndamentoRpc";
import { fmtNum } from "@/lib/formatters";

const ALERTAS_LIMIT = 2000;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  from?: string;
  to?: string;
  vendedor?: string;
  cidade?: string;
  /** Mediana mostrada no KPI: entra em alerta quem está nesse valor ou acima. */
  diasMin: number | null | undefined;
  active?: boolean;
}

/**
 * Drill-down do KPI Dias sem Ação. Usa exatamente os campos da tabela Em
 * Andamento, mas mostra somente os negócios que atingiram a régua do alerta.
 */
export function AcoesDiasSemAcaoModal({
  open, onOpenChange, from, to, vendedor, cidade, diasMin, active = true,
}: Props) {
  const alertaAtivo = diasMin != null && Number.isFinite(diasMin);
  const consulta = useEmAndamentoRpc({
    from,
    to,
    vendedor,
    cidade,
    limit: ALERTAS_LIMIT,
    enabled: open && active && alertaAtivo,
  });

  const alertas = useMemo(
    () => consulta.data?.rows.filter((negocio) => negocio.diasParado >= (diasMin ?? Number.POSITIVE_INFINITY)) ?? [],
    [consulta.data?.rows, diasMin],
  );
  const totalCarteira = consulta.data?.total ?? 0;
  const titulo = alertaAtivo
    ? `Alertas: ${fmtNum(diasMin)}+ dias sem ação`
    : "Alertas de dias sem ação";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[1500px] overflow-y-auto bg-[var(--voux-card-from)] p-4 sm:rounded-xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {alertaAtivo
              ? `Negócios em andamento com ${fmtNum(diasMin)} dias ou mais desde a última ação. ${fmtNum(alertas.length)} alerta(s) de ${fmtNum(totalCarteira)} negócio(s) da carteira.`
              : "Não há uma régua de dias disponível para abrir os alertas."}
          </DialogDescription>
        </DialogHeader>

        {alertaAtivo && (
          <AcoesEmAndamentoTable
            rows={alertas}
            total={alertas.length}
            page={1}
            pageSize={ALERTAS_LIMIT}
            onPageChange={() => undefined}
            loading={consulta.isLoading || consulta.isPlaceholderData}
            error={consulta.error}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
