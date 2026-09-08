import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAI } from "@/lib/fetchAI";
import { streamAIChat } from "@/services/yaChatService";

vi.mock("@/lib/fetchAI", () => ({ fetchAI: vi.fn() }));

const mockedFetchAI = vi.mocked(fetchAI);

describe("streamAIChat", () => {
  beforeEach(() => {
    mockedFetchAI.mockReset();
  });

  it("dispatches the validated plan, evidence and completed answer", async () => {
    const events = [
      'event: plan\ndata: {"query_spec":{"intent":"metric","metrics":["vendas.faturamento"]}}\n\n',
      'event: sources\ndata: {"sources":[{"id":"sales","label":"Vendas","filters":{}}],"db_ms":12,"cache_hits":1}\n\n',
      'event: delta\ndata: {"text":"R$ 10"}\n\n',
      'event: done\ndata: {"conversation_id":"conversation-1","assistant_message_id":"message-1","answer":"R$ 10","sources":[],"evidence":[],"query_spec":{"intent":"metric"},"generated_at":"2026-09-08T10:00:00Z"}\n\n',
    ].join("");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(events));
        controller.close();
      },
    });
    mockedFetchAI.mockResolvedValue(new Response(stream, { status: 200 }));

    const plans: Record<string, unknown>[] = [];
    const deltas: string[] = [];
    const done: string[] = [];
    await streamAIChat(
      { message: "faturamento", context: { route: "/bi/painel", filters: {} } },
      {
        onPlan: (querySpec) => plans.push(querySpec),
        onDelta: (text) => deltas.push(text),
        onDone: (payload) => done.push(`${payload.conversationId}:${payload.assistantMessageId}:${payload.answer}`),
      },
    );

    expect(plans).toEqual([{ intent: "metric", metrics: ["vendas.faturamento"] }]);
    expect(deltas).toEqual(["R$ 10"]);
    expect(done).toEqual(["conversation-1:message-1:R$ 10"]);
  });
});
