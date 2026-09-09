"""Human-facing artifacts for the official sales tool."""

from __future__ import annotations

from typing import Any

from ya_agent_models import AgentArtifact
from ya_agent_tools.common import chart_artifact, kpi_artifact, table_artifact


LOSS_DIMENSIONS = (
    ("motivos", "Perdas por motivo"),
    ("vendedores", "Perdas por vendedor"),
    ("cidades", "Perdas por cidade"),
    ("produtos", "Perdas por produto"),
    ("origens", "Perdas por origem"),
)


def build_sales_artifacts(data: dict[str, Any], blocks: list[str], presentation: str, source_id: str) -> list[AgentArtifact]:
    artifacts: list[AgentArtifact] = []
    kpis = data.get("kpis") if isinstance(data, dict) else {}
    if "kpis" in blocks and isinstance(kpis, dict):
        rows = [
            {"label": label, "value": kpis[key], "unit": unit}
            for key, label, unit in (
                ("totalPedidos", "Pedidos aprovados", "quantidade"),
                ("faturamento", "Faturamento", "BRL"),
                ("ticketMedio", "Ticket médio", "BRL/pedido"),
                ("totalPerdido", "Negócios perdidos", "quantidade"),
                ("valorPerdido", "Valor perdido", "BRL"),
            )
            if key in kpis
        ]
        artifact = kpi_artifact("Indicadores de vendas", rows, source_id)
        if artifact:
            artifacts.append(artifact)
    if presentation == "linha":
        artifact = chart_artifact("line", "Evolução mensal", data.get("series", []), source_id, "name")
        if artifact:
            artifacts.append(artifact)
    losses = data.get("perdas") if isinstance(data, dict) else {}
    if isinstance(losses, dict) and any(block in blocks for block in ("perdas", "rankings", "produtos")):
        for key, title in LOSS_DIMENSIONS:
            rows = losses.get(key)
            if not isinstance(rows, list) or not rows:
                continue
            x_key = _label_key(rows)
            if presentation == "barras" and len(artifacts) < 4:
                artifact = chart_artifact("bar", title, rows, source_id, x_key)
            else:
                artifact = table_artifact(title, rows, source_id)
            if artifact:
                artifacts.append(artifact)
    rankings = data.get("rankings") if isinstance(data, dict) else {}
    if isinstance(rankings, dict) and not losses:
        ranking_titles = {
            "vendedores": "Ranking de vendedores",
            "cidades": "Ranking de cidades",
            "produtos": "Ranking de produtos",
            "origens": "Ranking de origens",
            "bancos": "Ranking de bancos",
            "tipos_cliente": "Ranking de tipos de cliente",
        }
        for key, title in ranking_titles.items():
            rows = rankings.get(key)
            if not isinstance(rows, list) or not rows:
                continue
            if presentation == "barras" and len(artifacts) < 4:
                artifact = chart_artifact("bar", title, rows, source_id, _label_key(rows))
            elif presentation == "tabela":
                artifact = table_artifact(title, rows, source_id)
            else:
                artifact = None
            if artifact:
                artifacts.append(artifact)
    return artifacts[:12]


def _label_key(rows: list[dict[str, Any]]) -> str:
    for key in ("name", "nome", "motivo", "vendedor", "consultor", "cidade", "produto", "origem", "label"):
        if any(isinstance(row, dict) and row.get(key) not in (None, "") for row in rows):
            return key
    return "name"
