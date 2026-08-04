import { AlertTriangle } from "lucide-react";

interface StatusDesconhecidoAlertProps {
  /** Quantidade de negocios com status fora de Ganho/Perdido/Em Andamento */
  count: number;
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
export function StatusDesconhecidoAlert({ count }: StatusDesconhecidoAlertProps) {
  if (count <= 0) return null;

  const num = (v: number) => v.toLocaleString("pt-BR");

  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-[var(--voux-danger)]/40 bg-[var(--voux-danger)]/[0.06] p-3 text-xs"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--voux-danger)]" aria-hidden="true" />
      <p className="text-[var(--voux-text-primary)]">
        <span className="font-medium">
          {num(count)} negocio(s) fecharam no periodo com status fora de Em
          Andamento/Ganho/Perdido.
        </span>{" "}
        Eles nao entram em nenhum card desta tela — nem em Ganho, nem em Perdido. Existe um 4o status de
        negocio no ERP que o BI ainda nao representa. Avise o time de dados.
      </p>
    </div>
  );
}
