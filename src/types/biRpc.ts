/**
 * Barril de tipos das RPCs de BI.
 *
 * As definicoes vivem em `src/types/bi/{rpc}.ts` — uma por RPC. Este arquivo
 * so reexporta, entao qualquer consumidor continua importando de `@/types/biRpc`
 * sem saber do corte. Motivo do split: o arquivo unico cruzou o hard gate de 400
 * linhas (`coding-standards.md` #4) e so tendia a crescer, ja que toda RPC nova
 * do BI aterrissava aqui.
 *
 * Ao adicionar uma RPC nova: crie `src/types/bi/{nome}.ts` e reexporte abaixo.
 */

export * from "./bi/negocios";
export * from "./bi/pedidos";
export * from "./bi/servicos";
export * from "./bi/admin";
export * from "./bi/acoes";
export * from "./bi/acoesGestao";
export * from "./bi/inteligencia";
export * from "./bi/parque";
export * from "./bi/etl";
export * from "./bi/operacional";
export * from "./bi/produtos";
export * from "./bi/acoesPedidosGanhos";
export * from "./bi/acoesNegociosPerdidos";
export * from "./bi/acoesEmAndamento";
export * from "./bi/acoesTermometro";
export * from "./bi/clientesCriticos";
