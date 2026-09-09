import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAI } from "@/lib/fetchAI";
import { readEvent, sendYaChat, streamAIChat } from "@/services/yaChatService";

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

  it("forwards the active conversation and accepts CRLF SSE frames", async () => {
    const events = [
      'event: thread\r\ndata: {"conversation_id":"conversation-2"}\r\n\r\n',
      'event: done\r\ndata: {"conversation_id":"conversation-2","assistant_message_id":"message-2","answer":"Resposta","sources":[],"evidence":[],"query_spec":{},"generated_at":"2026-09-08T10:00:00Z"}\r\n\r\n',
    ].join("");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(events));
        controller.close();
      },
    });
    mockedFetchAI.mockResolvedValue(new Response(stream, { status: 200 }));

    const threads: string[] = [];
    await streamAIChat(
      { message: "e no mês anterior?", conversation_id: "conversation-1", context: { route: "/bi", filters: {} } },
      { onThread: (conversationId) => threads.push(conversationId) },
    );

    expect(threads).toEqual(["conversation-2"]);
    const [, init] = mockedFetchAI.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({ conversation_id: "conversation-1" });
  });

  it("parses tool progress and structured artifacts when frames arrive split", async () => {
    const events = [
      'event: tool_start\ndata: {"label":"desempenho de vendas","position":1}\n\n',
      'event: tool_result\ndata: {"label":"desempenho de vendas","status":"ok","artifacts":[{"type":"kpi_group","title":"Indicadores","rows":[{"label":"Vendas","value":3}]}],"warnings":[]}\n\n',
      'event: done\ndata: {"conversation_id":"conversation-3","assistant_message_id":"message-3","answer":"Foram 3 vendas.","sources":[],"evidence":[],"artifacts":[{"type":"kpi_group","title":"Indicadores","rows":[{"label":"Vendas","value":3}]}],"choices":[{"label":"Ver por vendedor","value":"Mostre por vendedor"}],"query_spec":{},"generated_at":"2026-09-08T10:00:00Z"}\n\n',
    ].join("");
    const bytes = new TextEncoder().encode(events);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 17));
        controller.enqueue(bytes.slice(17, 93));
        controller.enqueue(bytes.slice(93));
        controller.close();
      },
    });
    mockedFetchAI.mockResolvedValue(new Response(stream, { status: 200 }));

    const started: string[] = [];
    const artifacts: number[] = [];
    const choices: string[] = [];
    await streamAIChat(
      { message: "resultado", context: { route: "/bi", filters: {} } },
      {
        onToolStart: ({ label }) => started.push(label),
        onToolResult: ({ artifacts: resultArtifacts }) => artifacts.push(resultArtifacts.length),
        onDone: ({ artifacts: resultArtifacts, choices: resultChoices }) => {
          artifacts.push(resultArtifacts.length);
          choices.push(resultChoices[0]?.value ?? "");
        },
      },
    );

    expect(started).toEqual(["desempenho de vendas"]);
    expect(artifacts).toEqual([1, 1]);
    expect(choices).toEqual(["Mostre por vendedor"]);
  });

  it("rejects malformed event JSON without breaking the parser", () => {
    expect(readEvent("event: status\ndata: {not-json}\n\n")).toBeNull();
    expect(readEvent("event: status\ndata: {\"message\":\"ok\"}\n\n")).toEqual({ event: "status", data: { message: "ok" } });
  });
});

describe("sendYaChat", () => {
  beforeEach(() => {
    mockedFetchAI.mockReset();
  });

  it("uses the v2 REST endpoint when the feature flag is enabled", async () => {
    vi.stubEnv("VITE_YA_AGENT_V2_ENABLED", "true");
    mockedFetchAI.mockResolvedValue(new Response(JSON.stringify({ answer: "ok" }), { status: 200 }));

    await sendYaChat({ message: "resultado", context: { route: "/bi", filters: {} } });

    expect(mockedFetchAI.mock.calls[0]?.[0]).toBe("/api/ai/v2/chat");
    vi.unstubAllEnvs();
  });

  it("keeps the legacy REST endpoint available when v2 is disabled", async () => {
    vi.stubEnv("VITE_YA_AGENT_V2_ENABLED", "false");
    mockedFetchAI.mockResolvedValue(new Response(JSON.stringify({ answer: "ok" }), { status: 200 }));

    await sendYaChat({ message: "resultado", context: { route: "/bi", filters: {} } });

    expect(mockedFetchAI.mock.calls[0]?.[0]).toBe("/api/ai/chat");
    vi.unstubAllEnvs();
  });
});
