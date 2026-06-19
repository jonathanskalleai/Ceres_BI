# Mapa de Relacionamentos entre Views

Chaves identificadas no sample (10 linhas × 29 views).

## Diagrama macro

```text
                        ┌──────────────────────┐
                        │  VW_Ceres_Empresas   │
                        │  (EMP_idEmpresa, 4)  │
                        └──────────┬───────────┘
                                   │ EMP_idEmpresa / EMP_CodFilial
            ┌──────────────────────┼──────────────────────┐
            │                      │                      │
   ┌────────▼─────────┐  ┌─────────▼────────┐  ┌──────────▼──────────┐
   │ VW_Ceres_Usuario │  │ UsuarioXEmpresa  │  │  (todas as fatos)   │
   │ (USR_idUsuario)  │  │  (269 vínculos)  │  └─────────────────────┘
   └────────┬─────────┘  └──────────────────┘
            │ USR_idUsuario / USR_CodUsuario
            │
            ▼ (vendedor / técnico / responsável)

  ┌─────────────────────────── CRM ───────────────────────────┐
  │                                                            │
  │  CarteiraClientes ◄──── CLI_idCliente ────┐                │
  │  (15 020)                                  │               │
  │     │                                      │               │
  │     ├── ClienteContatos (8 518)            │               │
  │     ├── ClienteParqueMaquinas (1 526)      │               │
  │     ├── ClientePropriedade (341)           │               │
  │     └── TAGXCLIENTE (1 095)                │               │
  │                                            │               │
  │  Acoes (28 999) ──CLI_IdCliente────────────┤               │
  │     │                                      │               │
  │     ├── NGO_NroNegocio ──► Negocios        │               │
  │     └── TAGXACAO (6 712) via ACO_idAcao    │               │
  │                                            │               │
  │  Negocios (4 752) ──CLI_IdCliente──────────┤               │
  │     │   │                                  │               │
  │     │   ├── NGO_Numero ──► Pedidos         │               │
  │     │   ├── NGO_Numero ──► Negocios_Etapas │               │
  │     │   ├── NGO_IdFunil/IdEtapa ──► FunilEtapa             │
  │     │   ├── PRD_IdProduto ──► Produtos                     │
  │     │   ├── PRD_IdMarcaProduto ──► ProdutosMarca           │
  │     │   ├── PRD_IdGrupoProduto ──► ProdutosGrupo           │
  │     │   ├── PRD_IdModeloProduto ──► ProdutosModelo         │
  │     │   ├── NGO_Vendedores ──► Usuario.USR_CodUsuario      │
  │     │   └── TAGXNEGOCIO (1 415) via NGO_Numero             │
  │     │                                                       │
  │  Pedidos (2 086) ──NGO_Numero──┐                            │
  │     │                          └─► Negocios                 │
  │     ├── PedidosItem (2 703) via PDO_NroPedido               │
  │     ├── PedidosUsado (16)                                   │
  │     └── TAGXPEDIDO (577) via PED_Numero                     │
  │                                                              │
  └──────────────────────────────────────────────────────────────┘

  ┌─────────────────────── PÓS-VENDA ────────────────────────────┐
  │                                                               │
  │  OrdemServico (147) ──OS_idCliente──► CarteiraClientes        │
  │     │                ──OS_idOS──┐                             │
  │     │                           ├─► Agenda (152)              │
  │     │                           ├─► AtendimentoOS (152)       │
  │     │                           ├─► Ocorrencias (1 027)       │
  │     │                           └─► AtividadeExtra (52)       │
  │     │                                                          │
  │  TecnicoTempo (8 791) ──USR_idUsuario──► Usuario               │
  │                                                                │
  └────────────────────────────────────────────────────────────────┘
```

## Tabela de joins (view A × view B × chave × confiança)

| View A | View B | Chave | Confiança | Uso |
|---|---|---|---|---|
| Acoes | CarteiraClientes | CLI_IdCliente | ALTA | Cidade real do cliente |
| Acoes | Negocios | NGO_NroNegocio = NGO_Numero | ALTA | Atribuir ação ao negócio |
| Acoes | TAGXACAO | ACO_IdAcao = ACO_idAcao | ALTA | Tags da ação |
| Negocios | Pedidos | NGO_Numero | ALTA | Pedido do negócio |
| Negocios | Negocios_Etapas | NGO_Numero | ALTA | Histórico de etapas |
| Negocios | FunilEtapa | NGO_IdFunil + NGO_IdEtapa | ALTA | SLA por etapa |
| Negocios | Usuario | NGO_Vendedores = USR_CodUsuario | ALTA | Nome do vendedor |
| Negocios | CarteiraClientes | CLI_IdCliente | ALTA | 360 cliente |
| Negocios | Produtos | PRD_IdProduto | ALTA | Catálogo |
| Negocios | TAGXNEGOCIO | NGO_Numero | ALTA | Tags do negócio |
| Pedidos | PedidosItem | PDO_NroPedido = PED_NroPedido | ALTA | Itens vendidos (mix) |
| Pedidos | TAGXPEDIDO | PDO_NroPedido = PED_Numero | ALTA | Tags do pedido |
| OrdemServico | AtendimentoOS | OS_idOS | ALTA | Causa/solução |
| OrdemServico | Ocorrencias | OS_idOS / OSE_idOS | ALTA | Eventos dentro da OS |
| OrdemServico | Agenda | OS_idOS | ALTA | Agendamento |
| OrdemServico | AtividadeExtra | OSE_idOS | ALTA | Atividade extra |
| OrdemServico | CarteiraClientes | OS_idCliente = CLI_idCliente | ALTA | Cliente da OS |
| CarteiraClientes | ParqueMaquinas | CLI_idCliente | ALTA | Base instalada |
| CarteiraClientes | Propriedade | CLI_idCliente | ALTA | Hectares/cultura |
| CarteiraClientes | Contatos | CLI_idCliente | ALTA | Contatos do cliente |
| CarteiraClientes | TAGXCLIENTE | CLI_idCliente | ALTA | Segmentação |
| ParqueMaquinas | ProdutosModelo | PQM_CodigoProdutoModelo | MÉDIA | Inferência de modelo |
| TecnicoTempo | Usuario | USR_idUsuario | ALTA | Quem é o técnico |
| AtendimentoOS | OrdemServico | ATD_idAtendimento + OS_idOS | ALTA | MTTR |

## Joins de alto valor ainda não explorados

1. **Negocios × Negocios_Etapas × FunilEtapa** → funil real com SLA.
2. **Pedidos × PedidosItem × Produtos × Grupo/Marca/Modelo** → mix de vendas por categoria/marca.
3. **OrdemServico × AtendimentoOS × Ocorrencias × TecnicoTempo** → diagnóstico de pós-venda + produtividade.
4. **CarteiraClientes × ParqueMaquinas × Negocios** → share-of-wallet (quanto do parque vem de nós).
5. **CarteiraClientes × Propriedade × Negocios** → potencial por hectare e sazonalidade por cultura.
6. **Acoes × TAGXACAO** e família → análise tag-based (segmentação).
