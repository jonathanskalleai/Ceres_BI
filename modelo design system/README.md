# Voux BI — Front-end

Front-end completo de um BI para provedores de internet, usando o **VOUX Design System** (editorial dark).

## Estrutura

```
voux-bi/
├── index.html                    # Visão Geral
├── ordens-servico.html           # Ordens de Serviço
├── atendimento.html              # Atendimento (SAC)
├── estoque.html                  # Estoque
├── contratos-ativos.html         # Contratos Ativos
├── contratos-cancelados.html     # Contratos Cancelados
├── vendas-ativacao.html          # Vendas × Ativação
├── financeiro.html               # A Receber (detalhado)
├── a-pagar.html                  # A Pagar (despesas)
├── inadimplencia.html            # Inadimplência ano atual
├── cobranca.html                 # Cobrança operacional
└── assets/
    ├── voux.css                  # Tokens + componentes VOUX
    ├── layout.css                # Layout do app (sidebar, topbar, grids)
    ├── data.js                   # Mock data central → substituir por Supabase
    ├── charts.js                 # Biblioteca de gráficos SVG custom
    ├── layout.js                 # Renderiza sidebar + topbar + toolbar
    └── font-system.js            # Seletor live de tipografia
```

## Conectando ao Supabase (próximo passo)

Toda a data viva em **`assets/data.js`** no objeto `window.VOUX_DATA`. Para conectar ao Supabase, substitua os arrays por chamadas async mantendo o mesmo shape.

### Tabelas sugeridas no Supabase

| Tabela | Campos principais |
|---|---|
| `clientes` | id, nome, cpf_cnpj, tipo_pessoa (PF/PJ), cidade, bairro, plano_id, status |
| `contratos` | id, cliente_id, plano_id, vendedor_id, ponto_acesso_id, valor, data_adesao, data_ativacao, data_cancelamento, motivo_cancel, status |
| `planos` | id, nome, velocidade, valor, tipo (SCM/SVA) |
| `vendedores` | id, nome, role |
| `ordens_servico` | id, contrato_id, tipo, operador_id, status (Aberta/Encerrada), data_abertura, data_encerramento, cidade, bairro |
| `atendimentos` | id, contrato_id, processo, operador_id, com_os (bool), status, data_abertura, data_encerramento |
| `faturas` | id, contrato_id, valor, valor_recebido, data_vencimento, data_liquidacao, status (Aberto/Recebido/Vencido) |
| `cobrancas` | id, fatura_id, operador_id, status (Liquidado/Não Liquidado), valor_acordo, desconto |
| `movimentacoes_estoque` | id, produto_id, tipo (Compra/Venda/Comodato/Retirada/etc), io (Entrada/Saída), quantidade, valor_unit, valor_total, data, categoria |
| `produtos` | id, codigo, descricao, categoria, valor_unit |
| `pontos_acesso` | id, nome (OLT) |

### Exemplo de substituição (data.js)

```js
// ANTES (mock)
const overview = { receita_mes: 296924, ... };

// DEPOIS (Supabase)
const { data: receitaMes } = await supabase
  .from("faturas")
  .select("valor_recebido")
  .eq("status", "Recebido")
  .gte("data_liquidacao", inicioMes);
const overview = { receita_mes: receitaMes.reduce((a,b) => a + b.valor_recebido, 0) };
```

## Design System

- **VOUX v1.0** — editorial dark, fundo ink `#0a0907`, acento champagne `#d4b896`
- **Fontes**: Instrument Serif (display), Inter (corpo), JetBrains Mono (labels)
- Componentes em `assets/voux.css` seguindo os tokens do design system

## Gráficos

Biblioteca custom em `assets/charts.js` — sem dependências externas, todos SVG:
- `barH` — barras horizontais
- `barV` — barras verticais
- `barStacked` — barras empilhadas
- `barHDual` — barras horizontais duplas (comparativo)
- `line` — linha (multi-séries)
- `donut` — donut/pizza
- `gauge` — gauge semi-circular
- `radial` — progresso circular
- `sparkline` — mini gráfico inline
- `heatbar` — heatmap em linha

## Como rodar

Abrir `index.html` em qualquer navegador. Não requer build, server ou deps.

Para hospedar: subir a pasta inteira em Vercel, Netlify ou qualquer host estático.
