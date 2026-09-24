export interface BiQualityIssue {
  code: string;
  message: string;
  source?: string;
}

export interface BiQualityEvent {
  source: string;
  route?: string;
  requestId?: string;
  status: "partial" | "stale";
  issues: BiQualityIssue[];
  occurredAt: string;
}

type Listener = () => void;

const MAX_EVENTS = 20;
let snapshot: BiQualityEvent[] = [];
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

function eventKey(event: BiQualityEvent): string {
  return `${event.source}:${event.status}:${event.issues.map((item) => item.code).sort().join(",")}`;
}

export const biQuality = {
  getSnapshot(): BiQualityEvent[] {
    return snapshot;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  record(event: BiQualityEvent): void {
    const key = eventKey(event);
    const next = snapshot.filter((item) => eventKey(item) !== key);
    snapshot = [event, ...next].slice(0, MAX_EVENTS);
    notify();
  },

  clear(source: string): void {
    const next = snapshot.filter((event) => event.source !== source);
    if (next.length === snapshot.length) return;
    snapshot = next;
    notify();
  },

  clearAll(): void {
    if (snapshot.length === 0) return;
    snapshot = [];
    notify();
  },
};
