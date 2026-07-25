import { AlertTriangle } from "lucide-react";

/**
 * Estado de erro EXPLICITO para os blocos de gestao comercial.
 *
 * Sem ele, uma RPC que falha renderiza o funil 0 → 0 → 0 e o ranking vazio, e
 * o gestor le isso como "nao houve movimento no periodo" — um dado FALSO com a
 * mesma cara de um dado verdadeiro. Mesma regra do `BiTableCard`: consulta que
 * falhou nunca pode cair no estado vazio.
 */
export function BiGestaoErro({ error, contexto }: { error: Error; contexto: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 py-4 text-xs text-[var(--voux-text-primary)]">
      <AlertTriangle className="mt-[2px] h-4 w-4 shrink-0 text-[var(--voux-danger)]" aria-hidden="true" />
      <div>
        <p className="font-medium">Nao foi possivel carregar {contexto}.</p>
        <p className="mt-1 text-[var(--voux-text-muted)]">
          Os numeros NAO seriam “zero no periodo” — a consulta falhou. Recarregue a pagina; se persistir,
          avise o time de dados.
        </p>
        <p className="mt-1 break-all font-mono text-[11px] text-[var(--voux-text-muted)]">{error.message}</p>
      </div>
    </div>
  );
}
