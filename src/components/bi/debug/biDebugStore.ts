/**
 * Lightweight pub/sub store for BI debug info.
 * Hooks/services call `biDebug.set()` to publish debug data;
 * the overlay subscribes via `useSyncExternalStore`.
 *
 * Zero runtime cost when overlay is not mounted (no subscribers = no re-renders).
 */

export interface BiDebugEntry {
  /** Label (e.g. "useNegociosBI") */
  source: string;
  /** Filters sent to Supabase (server-side) */
  queryParams: Record<string, unknown>;
  /** Counts for transparency */
  counts: {
    rawFromServer: number;
    afterDedupe: number;
    afterClientFilter: number;
  };
  /** Timestamp of last update */
  updatedAt: number;
}

type Listener = () => void;

let snapshot: BiDebugEntry[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

export const biDebug = {
  set(entry: BiDebugEntry) {
    const idx = snapshot.findIndex((e) => e.source === entry.source);
    const next = [...snapshot];
    if (idx >= 0) next[idx] = entry;
    else next.push(entry);
    snapshot = next;
    emit();
  },

  remove(source: string) {
    snapshot = snapshot.filter((e) => e.source !== source);
    emit();
  },

  getSnapshot(): BiDebugEntry[] {
    return snapshot;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};
