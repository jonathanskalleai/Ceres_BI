import { useEffect } from "react";
import { biDebug } from "./biDebugStore";

interface PublishOptions {
  source: string;
  queryParams: Record<string, unknown>;
  rawFromServer: number;
  afterDedupe: number;
  afterClientFilter: number;
}

/**
 * Publishes debug counts/params to the BiDebug overlay store.
 * No-op when overlay is disabled (store listeners empty = zero cost).
 * Call this in hooks that fetch BI data.
 */
export function useBiDebugPublisher(opts: PublishOptions) {
  const { source, queryParams, rawFromServer, afterDedupe, afterClientFilter } = opts;

  useEffect(() => {
    biDebug.set({
      source,
      queryParams,
      counts: { rawFromServer, afterDedupe, afterClientFilter },
      updatedAt: Date.now(),
    });
    return () => { biDebug.remove(source); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, rawFromServer, afterDedupe, afterClientFilter]);
}
