import { fetchBiApi } from "@/services/bi/biApiTransport";
import { BiContractError, issue } from "@/types/biRuntime";

export type AcoesBatchBlock = "core" | "funil";

export interface AcoesBatchParams {
  from?: string;
  to?: string;
  vendedor?: string;
  tipoAcao?: string;
  cidade?: string;
}

interface BatchData {
  core?: unknown;
  funil?: unknown;
}

interface Subscriber {
  block: AcoesBatchBlock;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  signal?: AbortSignal;
  abortHandler?: () => void;
  aborted: boolean;
}

interface PendingBatch {
  params: AcoesBatchParams;
  subscribers: Subscriber[];
  controller: AbortController;
  queued: boolean;
}

const pending = new Map<string, PendingBatch>();

function normalizeParams(params: AcoesBatchParams): AcoesBatchParams {
  // AcoesBIParams also carries AbortSignal for React Query. It is transport
  // control, never a filter, and must not leak into URLSearchParams.
  return {
    ...(params.from !== undefined ? { from: params.from } : {}),
    ...(params.to !== undefined ? { to: params.to } : {}),
    ...(params.vendedor !== undefined ? { vendedor: params.vendedor } : {}),
    ...(params.tipoAcao !== undefined ? { tipoAcao: params.tipoAcao } : {}),
    ...(params.cidade !== undefined ? { cidade: params.cidade } : {}),
  };
}

function paramsKey(params: AcoesBatchParams): string {
  return JSON.stringify([
    params.from ?? null,
    params.to ?? null,
    params.vendedor ?? null,
    params.tipoAcao ?? null,
    params.cidade ?? null,
  ]);
}

function abortError(): Error {
  const error = new Error("Consulta cancelada porque os filtros mudaram");
  error.name = "AbortError";
  return error;
}

function missingBlockError(block: AcoesBatchBlock): BiContractError {
  return new BiContractError(
    `O bloco ${block} não foi retornado pelo lote de Ações`,
    [issue("BI_BATCH_BLOCK_MISSING", `O bloco ${block} está indisponível`, block, "error")],
    "BI_CONTRACT_MISSING",
  );
}

function removeSubscriber(batch: PendingBatch, subscriber: Subscriber): void {
  if (subscriber.aborted) return;
  subscriber.aborted = true;
  subscriber.reject(abortError());
  if (batch.subscribers.every((item) => item.aborted)) batch.controller.abort();
}

function settleSubscriber(subscriber: Subscriber, action: () => void): void {
  if (subscriber.abortHandler) {
    subscriber.signal?.removeEventListener("abort", subscriber.abortHandler);
  }
  action();
}

async function flush(key: string, batch: PendingBatch): Promise<void> {
  pending.delete(key);
  const active = batch.subscribers.filter((subscriber) => !subscriber.aborted);
  if (active.length === 0) return;
  const blocks = new Set(active.map((subscriber) => subscriber.block));
  const onlyBlock = blocks.size === 1 ? active[0].block : null;
  const path = onlyBlock === "core"
    ? "/acoes/core"
    : onlyBlock === "funil"
      ? "/acoes/funil"
      : "/acoes/batch";
  try {
    const response = await fetchBiApi<BatchData | unknown>(path, batch.params as Record<string, unknown>, batch.controller.signal);
    const data = onlyBlock ? { [onlyBlock]: response } : response as BatchData;
    for (const subscriber of active) {
      if (subscriber.aborted) continue;
      const value = data[subscriber.block];
      settleSubscriber(subscriber, () => {
        if (value === undefined) subscriber.reject(missingBlockError(subscriber.block));
        else subscriber.resolve(value);
      });
    }
  } catch (error) {
    for (const subscriber of active) {
      if (!subscriber.aborted) settleSubscriber(subscriber, () => subscriber.reject(error));
    }
  }
}

/**
 * Queue one Ações block for the current tick. Core and funil calls created by
 * the same render/fetch wave share one authenticated /acoes/batch request;
 * callers still receive their original block shape and validation path.
 */
export function fetchAcoesBatchBlock(
  block: AcoesBatchBlock,
  params: AcoesBatchParams,
  signal?: AbortSignal,
): Promise<unknown> {
  if (signal?.aborted) return Promise.reject(abortError());
  const normalizedParams = normalizeParams(params);
  const key = paramsKey(normalizedParams);
  let batch = pending.get(key);
  if (!batch) {
    batch = {
      params: normalizedParams,
      subscribers: [],
      controller: new AbortController(),
      queued: true,
    };
    pending.set(key, batch);
    queueMicrotask(() => {
      if (batch?.queued) {
        batch.queued = false;
        void flush(key, batch);
      }
    });
  }

  return new Promise((resolve, reject) => {
    const subscriber: Subscriber = { block, resolve, reject, signal, aborted: false };
    batch?.subscribers.push(subscriber);
    subscriber.abortHandler = () => removeSubscriber(batch!, subscriber);
    signal?.addEventListener("abort", subscriber.abortHandler, { once: true });
  });
}

/** Test-only cleanup; production code never needs to clear pending batches. */
export function resetAcoesBatchScheduler(): void {
  for (const batch of pending.values()) batch.controller.abort();
  pending.clear();
}
