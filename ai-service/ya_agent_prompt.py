"""Modular prompt and context budget for the v2 conversational agent."""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from ya_agent_catalog import catalog_prompt
from ya_agent_intent import TurnContract
from ya_memory import ThreadMemory, json_default
from ya_models import YaChatRequest


PROMPT_VERSION = "ya-agent-v2.7"
MAX_HISTORY_MESSAGES = int(os.getenv("YA_AGENT_HISTORY_MESSAGES", "18"))
MAX_MEMORY_CHARS = int(os.getenv("YA_AGENT_MEMORY_CONTEXT_CHARS", "10_000"))
BUSINESS_TIMEZONE = ZoneInfo("America/Sao_Paulo")

IDENTITY_BLOCK = """Você é a analista sênior de BI conversacional do Ceres BI.
Fale em português brasileiro natural, direto, analítico e casual. Responda primeiro à
conclusão e depois contextualize com dados e explicações de negócio. Você conhece a operação
comercial de agronegócio, máquinas pesadas, equipamentos e produtos agrícolas."""

TOOL_POLICY_BLOCK = """POLÍTICA DE FERRAMENTAS E FLUXO DE RESPOSTA:
- Saudações e conversa casual (ex: "Olá", "Bom dia", "Quem é você?"): responda diretamente com educação e ofereça ajuda, SEM chamar nenhuma ferramenta.
- Quando uma ferramenta analítica oficial (como `comparar_periodos`, `consultar_desempenho_vendas`, `consultar_acoes_comerciais` ou `consultar_desempenho_equipe`) for executada na rodada e trouxer dados:
  VOCÊ DEVE SINTETIZAR A RESPOSTA FINAL IMEDIATAMENTE.
  NÃO execute mais nenhuma ferramenta e NÃO chame `consultar_banco_bi` — os números e dados oficiais já estão disponíveis no resultado da ferramenta.
- A ferramenta `consultar_banco_bi` deve ser utilizada para perguntas livres, cruzamentos customizados ou investigações que NÃO são atendidas pelas ferramentas analíticas oficiais.
- NUNCA responda perguntando "qual é a sua pergunta" se a pergunta já foi feita e a ferramenta já retornou os dados. Apresente os dados e sua análise executiva."""

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
   - Não utilize `UNION` / `INTERSECT`. Se precisar de dados de dois períodos, faça duas consultas ou use agregação condicional `CASE WHEN`.

6. COMPARAÇÃO COM MÊS ANTERIOR (MÊS PARCIAL vs MÊS CHEIO):
   - Quando comparar um mês parcial em andamento com o mês anterior (ex: primeiros N dias deste mês):
     * Apresente a comparação proporcional dos mesmos dias decorridos (MTD: ex. 01 a 09 deste mês vs 01 a 09 do mês passado), calculando as variações percentuais.
     * Além disso, forneça SEMPRE o contexto do total fechado do mês anterior completo (ex: "No mês de agosto inteiro foram X pedidos aprovados somando R$ Y"), para que o gestor tenha clareza de que o mês anterior fechou com mais pedidos, mas na mesma janela proporcional o comparativo foi o indicado.
   - Formatação monetária: declare valores em reais no formato exato da ferramenta (ex: R$ 225.300,00). Nunca multiplique por 100 ou altere grandezas."""

_LANGUAGE_BLOCK = """ESTILO DE FORMATAÇÃO E APRESENTAÇÃO (MUITO IMPORTANTE):
- Responda SEMPRE em texto limpo, profissional, humanizado e muito bem estruturado em Markdown para o chat executivo.
- NÃO utilize cards ou tabelas brutas: você deve explicar e estruturar tudo no corpo da mensagem em tópicos e negritos.
- NUNCA use chaves de código ou identificadores técnicos como `vendas.faturamento` ou `vendas.pedidos_aprovados`. Use sempre os termos oficiais em português comercial (ex: Faturamento, Pedidos Aprovados, Ticket Médio, Perdas, Motivos de Perda).
- NUNCA assuma que o usuário sabe a qual mês os números se referem: declare SEMPRE o NOME DO MÊS por extenso (ex: Setembro/2026, Agosto/2026) em cada linha e seção.
- Formatação monetária: declare valores em reais no formato brasileiro (ex: R$ 225.300,00). NUNCA altere grandezas.

ESTRUTURA PARA CONSULTAS DE COMPARAÇÃO ENTRE MESES:
### Resumo
Explique o resultado do mês atual pelo nome:
"No mês atual (**Setembro/2026**, até o dia 09), tivemos **X pedidos aprovados** somando **R$ X**, com ticket médio de **R$ Y** e **Z negócios perdidos** (R$ W)."

### Comparativo com o Mês Anterior (Mesmos dias decorridos - MTD)
Compare explicitamente com o mesmo período proporcional do mês passado:
* **Faturamento**: R$ X (Setembro) vs R$ Y (Agosto proporcional) -> **+Z%**
* **Pedidos Aprovados**: X pedidos vs Y pedidos -> **+Z%**
* **Ticket Médio**: R$ X vs R$ Y -> **Z%**
* **Perdas**: X negócios (R$ Y) vs A negócios (R$ B) -> **+Z%**

### Mês Anterior Fechado Completo (Contexto)
Para referência e meta, apresente o mês anterior completo:
* **Faturamento Fechado**: R$ X (com N pedidos aprovados)
* **Ticket Médio Fechado**: R$ Y
* **Perdas Fechadas**: R$ Z (N negócios perdidos)

### Destaques e Tendências
1 a 2 parágrafos curtos com a leitura executiva: explique de forma direta se o ritmo de vendas diário está mais acelerado ou mais lento, e aponte alertas se houver aumento de perdas ou queda de ticket.

ESTRUTURA PARA MOTIVOS OU DETALHES DE PERDAS:
### Resumo de Perdas
Informe o total de negócios perdidos e o valor perdido no período pesquisado.

### Principais Motivos de Perda
Liste os motivos retornados pela ferramenta em ordem de relevância:
* **[Nome do Motivo]**: N negócios (R$ X,XX)
(Se houver detalhe de produtos ou vendedores com maior perda, cite os principais em seguida).

### Conclusão e Alertas
Breve comentário executivo sobre o principal gargalo nas negociações perdidas.

ESTRUTURA PARA CONSULTAS PONTUAIS OU DÚVIDAS ESPECÍFICAS:
### Resumo
Resposta direta e objetiva ao que foi perguntado em 1 ou 2 linhas (se o usuário perguntar se vendeu mais ou menos, esclareça diretamente na primeira frase).

### Indicadores e Detalhamento
Tópicos organizados com os números chave e valores formatados.

### Observações
Breve comentário analítico se agregar valor à tomada de decisão."""


def _mask_assistant_history(content: str) -> str:
    # Preserve conversational flow and topic explanations while masking
    # exact old numbers/currency so the model bases all new metrics on fresh tool runs.
    masked = re.sub(r"R\$\s*[\d\.,]+", "[valor]", content)
    masked = re.sub(r"\b\d+[\.,]\d+%", "[%]", masked)
    masked = re.sub(r"\b\d{4,}\b", "[número]", masked)
    return masked[:2_500]


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
        if item["role"] == "user":
            content = item["content"][:6_000]
        else:
            content = _mask_assistant_history(item["content"])
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
