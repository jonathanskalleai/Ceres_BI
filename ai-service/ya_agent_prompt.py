"""Modular prompt and context budget for the v2 conversational agent."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from ya_agent_catalog import catalog_prompt
from ya_agent_intent import TurnContract
from ya_memory import ThreadMemory, json_default
from ya_models import YaChatRequest


PROMPT_VERSION = "ya-agent-v2.3"
MAX_HISTORY_MESSAGES = int(os.getenv("YA_AGENT_HISTORY_MESSAGES", "18"))
MAX_MEMORY_CHARS = int(os.getenv("YA_AGENT_MEMORY_CONTEXT_CHARS", "10_000"))
BUSINESS_TIMEZONE = ZoneInfo("America/Sao_Paulo")

IDENTITY_BLOCK = """Você é a analista sênior de BI conversacional do Ceres BI.
Fale em português brasileiro natural, direto, analítico e casual. Responda primeiro à
conclusão e depois contextualize com dados e explicações de negócio. Você conhece a operação
comercial de agronegócio, máquinas pesadas, equipamentos e produtos agrícolas."""

TOOL_POLICY_BLOCK = """POLÍTICA DE FERRAMENTAS E BANCO DE DADOS:
- Saudações e conversa casual (ex: "Olá", "Bom dia", "Quem é você?"): responda diretamente com educação e ofereça ajuda, SEM chamar nenhuma ferramenta.
- Perguntas sobre dados, desempenho, faturamento, pedidos, perdas, rankings, comparações ou correlações: utilize a ferramenta `consultar_banco_bi` para consultar as tabelas espelhadas do Postgres (`mirror.*`).
- Você tem autonomia total para estruturar a consulta SQL necessária para responder à dúvida do usuário.
- Se a pergunta envolver comparação de períodos (ex: "resultado deste mês comparado com o mês passado"), consulte os dois períodos (ou faça agregações condicionais) para trazer a resposta completa e detalhada.
- Se faltar clareza essencial na pergunta, peça esclarecimento ou apresente o cenário mais plausível explicando os critérios adotados."""

BUSINESS_RULES_BLOCK = """REGRAS DE NEGÓCIO ESSENCIAIS DO CERES BI:
1. FILTRO DE FUNIL OBRIGATÓRIO:
   - Em qualquer consulta de vendas, faturamento, pedidos ou perdas, SEMPRE exclua o funil Repasse de Máquina por padrão:
     `WHERE ngo_funil NOT ILIKE '%REPASSE%'` (ou `ngo_funil != 'REPASSE DE MAQUINA'`).
   - Só inclua esse funil se o usuário solicitar expressamente (ex: "incluindo repasse" ou "somente repasse").

2. CONCEITO OFICIAL DE VENDA / FATURAMENTO (Ganhos):
   - Pedido com `pdo_situacao_pedido ILIKE '%aprovado%'`
   - Associado a negócio canônico em `mirror.crm_negocios` onde `ngo_conclusao = 'GANHO'` (junção `ON crm_pedidos.ngo_numero = crm_negocios.ngo_numero`)
   - Competência temporal oficial: data de aprovação do pedido (`pdo_dth_aprovacao`::date)
   - Faturamento = `SUM(pdo_vlr_pedido)`
   - Pedidos únicos = `COUNT(DISTINCT pdo_codigo_interno)`
   - Ticket Médio = `SUM(pdo_vlr_pedido) / NULLIF(COUNT(DISTINCT pdo_codigo_interno), 0)`

3. CONCEITO OFICIAL DE PERDAS:
   - Negócios em `mirror.crm_negocios` com `ngo_conclusao = 'PERDIDO'` (sempre excluindo repasse)
   - Competência: data de fechamento (`ngo_data_fechamento`::date)
   - Deduplicação obrigatória: deduplique por `ngo_numero` antes de somar ou contar perdas (`COUNT(DISTINCT ngo_numero)`).

4. AÇÕES COMERCIAIS E VISITAS:
   - Tabela `mirror.crm_acoes`
   - Competência: data de conclusão da ação (`aco_dth_conclusao`::date)
   - Visitas: `aco_tipo_contato ILIKE '%visita%'` ou `aco_tipo_acao ILIKE '%visita%'`.

5. DIRETRIZES DE SQL PARA `consultar_banco_bi`:
   - Somente `SELECT` em tabelas do schema `mirror` (ex: `mirror.crm_negocios`, `mirror.crm_pedidos`, `mirror.crm_pedidos_item`, `mirror.crm_acoes`, `mirror.crm_carteira_clientes`, `mirror.usuarios`).
   - Especifique sempre as colunas explicitamente (NUNCA utilize `SELECT *`).
   - Utilize JOINs explícitos (`JOIN ... ON ...`). Não utilize vírgula no FROM.
   - Não use comentários SQL (`--` ou `/* */`).
   - Não utilize `UNION` / `INTERSECT`. Se precisar de dados de dois períodos, faça duas consultas ou use agregação condicional `CASE WHEN`."""

_LANGUAGE_BLOCK = """Linguagem e apresentação:
- Nunca exponha senhas, tokens ou credenciais.
- Apresente os resultados em linguagem de negócios clara, com conclusões diretas, valores monetários formatados em R$, percentuais e contagens.
- Sempre declare de forma transparente o período analisado e a exclusão do funil Repasse."""


@dataclass(frozen=True)
class PromptContext:
    messages: list[dict[str, Any]]
    memory_chars: int


def build_system_prompt(request: YaChatRequest, memory: ThreadMemory, schema_text: str = "", contract: TurnContract | None = None) -> str:
    screen_context = json.dumps(request.context.model_dump(by_alias=True), ensure_ascii=False, default=json_default)
    state = json.dumps(_prompt_state(memory.state), ensure_ascii=False, default=json_default)[:6_000]
    durable = json.dumps(memory.user_memories, ensure_ascii=False, default=json_default)[:MAX_MEMORY_CHARS]
    schema = schema_text[:12_000] if schema_text else "SCHEMA RUNTIME: indisponível; use tabelas conhecidas mirror.crm_negocios, mirror.crm_pedidos, mirror.crm_acoes."
    contract_text = json.dumps(contract.prompt_payload(), ensure_ascii=False, default=json_default) if contract else "{\"intent\":\"compatibility\",\"required_tool\":null}"
    return "\n\n".join([
        IDENTITY_BLOCK,
        TOOL_POLICY_BLOCK,
        BUSINESS_RULES_BLOCK,
        _LANGUAGE_BLOCK,
        f"Data de referência do servidor em São Paulo: {datetime.now(BUSINESS_TIMEZONE).date().isoformat()}. Contexto da tela: {screen_context}",
        f"Versão do agente: {PROMPT_VERSION}.",
        f"MEMÓRIA DA THREAD:\n{_prompt_summary(memory.summary) or '(vazia)'}\nEstado por assunto: {state}",
        f"MEMÓRIAS DURADOURAS DO USUÁRIO:\n{durable or '(nenhuma)'}",
        "CONTRATO DO TURNO — contexto do servidor:\n" + contract_text,
        catalog_prompt(),
        schema,
        "Ao concluir, forneça a resposta diretamente em português estruturado (com negritos, tópicos e percentuais). Se houver opções de esclarecimento para o usuário, você pode incluir choices ou perguntar no final da resposta.",
    ])


def build_context(request: YaChatRequest, memory: ThreadMemory, schema_text: str = "", contract: TurnContract | None = None) -> PromptContext:
    history = []
    for item in memory.history[-MAX_HISTORY_MESSAGES:]:
        if item.get("role") not in {"user", "assistant"} or not item.get("content"):
            continue
        content = item["content"][:6_000] if item["role"] == "user" else "Resposta anterior registrada; não use seus números como evidência."
        history.append({"role": item["role"], "content": content})
    system = {"role": "system", "content": build_system_prompt(request, memory, schema_text, contract)}
    current = {"role": "user", "content": request.message.strip()}
    serialized_memory = system["content"]
    return PromptContext(messages=[system, *history, current], memory_chars=len(serialized_memory))


def _prompt_summary(summary: str) -> str:
    try:
        payload = json.loads(summary)
    except json.JSONDecodeError:
        return "Resumo contextual anterior disponível; não use números históricos."
    if isinstance(payload, dict):
        payload.pop("ultima_resposta", None)
        return json.dumps(payload, ensure_ascii=False, default=json_default)[:3_200]
    return "Resumo contextual anterior disponível; não use números históricos."


def _prompt_state(state: Any) -> Any:
    if not isinstance(state, dict):
        return {}
    output = dict(state)
    output.pop("last_answer", None)
    return output


def assistant_tool_message(message: dict[str, Any]) -> dict[str, Any]:
    """Keep only the provider fields required for the next tool round."""
    output: dict[str, Any] = {"role": "assistant", "content": message.get("content") or None}
    calls = message.get("tool_calls")
    if isinstance(calls, list):
        output["tool_calls"] = calls[:12]
    return output


def tool_result_message(call_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    return {"role": "tool", "tool_call_id": call_id, "content": json.dumps(payload, ensure_ascii=False, default=json_default)[:60_000]}


def parse_final_content(content: str) -> tuple[str, list[dict[str, str]]]:
    text = (content or "").strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start >= 0 and end > start:
            try:
                parsed = json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                parsed = None
        else:
            parsed = None
    if isinstance(parsed, dict) and isinstance(parsed.get("answer"), str):
        choices = []
        for item in parsed.get("choices", []):
            if isinstance(item, dict) and isinstance(item.get("label"), str) and isinstance(item.get("value"), str):
                choices.append({"label": item["label"][:120], "value": item["value"][:500]})
        return parsed["answer"].strip(), choices[:6]
    return text, []
