import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =============================================================================
// CORS & Config
// =============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function getSqlServerConfig() {
  const server = Deno.env.get("SQLSERVER_HOST");
  const database = Deno.env.get("SQLSERVER_DATABASE");
  const user = Deno.env.get("SQLSERVER_USER");
  const password = Deno.env.get("SQLSERVER_PASSWORD");
  const port = Number(Deno.env.get("SQLSERVER_PORT") || "1433");

  if (!server || !database || !user || !password) {
    throw new Error("SQL Server credentials not configured in secrets");
  }
  return { server, port, database, user, password };
}

function getSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured");
  }
  return createClient(url, serviceKey);
}

// =============================================================================
// Types
// =============================================================================

interface ViewConfig {
  table: string;
  sqlColumns: string[];
  mapRow: (row: Record<string, unknown>) => Record<string, unknown>;
  strategy: "full" | "incremental";
  watermarkCol?: string;
  conflictKey?: string;
  /** Horas de overlap para sync incremental — recaptura registros recentes para segurança. Default: 0 */
  overlapHours?: number;
}

interface SyncResult {
  view: string;
  status: "success" | "error";
  rows: number;
  duration_ms: number;
  error?: string;
}

// =============================================================================
// View Configuration Map
// =============================================================================

/** Convert empty strings to null — SQL Server returns "" for empty date fields, Postgres rejects them. */
const nullIfEmpty = (v: unknown): unknown => (v === "" || v === undefined ? null : v);

const VIEW_CONFIG: Record<string, ViewConfig> = {
  "VW_Ceres_CRM_Negocios": {
    table: "crm_negocios",
    sqlColumns: [
      "EMP_IdEmpresa", "EMP_CodFilial", "EMP_Nome", "EMP_CNPJ", "EMP_Cidade", "EMP_UF",
      "NGO_CodigoIntegracao", "NGO_Numero", "NGO_FormaEntradaCodIntegracao", "NGO_FormaEntrada",
      "NGO_VlrTotalNegociado", "PRD_IdNegocioXProduto", "PRD_dthRegistroProduto",
      "PRD_ProdutoCodigoIntegracao", "PRD_IdMarcaProduto", "PRD_MarcaProdutoCodIntegracao",
      "PRD_MarcaProduto", "PRD_IdProduto", "PRD_DscProduto", "PRD_CodigoProduto",
      "PRD_IdGrupoProduto", "PRD_GrupoProdutoCodIntegracao", "PRD_GrupoProduto",
      "PRD_IdModeloProduto", "PRD_ModeloProdutoCodIntegracao", "PRD_ModeloProduto",
      "PRD_CondicaoProduto", "PRD_Qtde", "PRD_VlrUnitario",
      "NGO_Probabilidade", "NGO_ObsNegocio", "NGO_IdFunil", "NGO_FunilCodIntegracao", "NGO_Funil",
      "NGO_IdEtapa", "NGO_EtapaCodIntegracao", "NGO_Etapa", "NGO_Evento", "NGO_Conclusao",
      "NGO_MotivoGanhoCodIntegracao", "NGO_MotivoGanho", "NGO_ObsMotivoGanho",
      "NGO_MotivoPerdaCodIntegracao", "NGO_Prioridade", "NGO_DataPrevisao", "NGO_Campanha",
      "NGO_MotivoPerda", "NGO_ObsMotivoPerda",
      "MPR_DscMotivoPerda", "MPR_DscMotivoPerdaDetalhe", "MPR_ProdutoPerdaMarca",
      "MPR_ProdutoPerdaGrupo", "MPR_ProdutoPerdaModelo", "MPR_ProdutoVlrConcorrencia", "MPR_MotivoObservacao",
      "MPP_DscMotivoPerda", "MPP_DscMotivoPerdaDetalhe", "MPP_ProdutoPerdaMarca",
      "MPP_ProdutoPerdaGrupo", "MPP_ProdutoPerdaModelo", "MPP_ProdutoVlrConcorrencia", "MPP_MotivoObservacao",
      "ORC_Valor", "ORC_Tipo", "ORC_Banco", "ORC_Observacao",
      "USA_Maquina", "USA_Valor", "USA_EstadoCodIntegracao", "USA_EstadoDescricao",
      "CLI_IdCliente", "CLI_CodigoCliente", "CLI_LojaClienteCodIntegracao", "CLI_CNPJ_CPF",
      "CLI_TipoCliente", "CLI_Nome", "CLI_Telefone", "CLI_Email", "CLI_Cidade", "CLI_UF",
      "NGO_Vendedores", "ACO_DataAgendaUltimaAcao", "ACO_ObsInicioUltimaAcao",
      "ACO_ObsFimUltimaAcao", "ACO_StatusUltimaAcao",
      "NGO_DataPrimeiroContato", "NGO_DataFechamento", "NGO_DataCadastro", "NGO_DataAtualizacao",
      "NGO_CicloVendas", "NGO_QtdAcoes", "dthRegistro",
    ],
    mapRow: (r) => ({
      emp_id_empresa: r.EMP_IdEmpresa,
      emp_cod_filial: r.EMP_CodFilial,
      emp_nome: r.EMP_Nome,
      emp_cnpj: r.EMP_CNPJ,
      emp_cidade: r.EMP_Cidade,
      emp_uf: r.EMP_UF,
      ngo_codigo_integracao: r.NGO_CodigoIntegracao,
      ngo_numero: r.NGO_Numero,
      ngo_forma_entrada_cod_integracao: r.NGO_FormaEntradaCodIntegracao,
      ngo_forma_entrada: r.NGO_FormaEntrada,
      ngo_vlr_total_negociado: r.NGO_VlrTotalNegociado,
      prd_id_negocio_x_produto: r.PRD_IdNegocioXProduto,
      prd_dth_registro_produto: nullIfEmpty(r.PRD_dthRegistroProduto),
      prd_produto_codigo_integracao: nullIfEmpty(r.PRD_ProdutoCodigoIntegracao),
      prd_id_marca_produto: nullIfEmpty(r.PRD_IdMarcaProduto),
      prd_marca_produto_cod_integracao: nullIfEmpty(r.PRD_MarcaProdutoCodIntegracao),
      prd_marca_produto: nullIfEmpty(r.PRD_MarcaProduto),
      prd_id_produto: nullIfEmpty(r.PRD_IdProduto),
      prd_dsc_produto: nullIfEmpty(r.PRD_DscProduto),
      prd_codigo_produto: nullIfEmpty(r.PRD_CodigoProduto),
      prd_id_grupo_produto: nullIfEmpty(r.PRD_IdGrupoProduto),
      prd_grupo_produto_cod_integracao: nullIfEmpty(r.PRD_GrupoProdutoCodIntegracao),
      prd_grupo_produto: nullIfEmpty(r.PRD_GrupoProduto),
      prd_id_modelo_produto: nullIfEmpty(r.PRD_IdModeloProduto),
      prd_modelo_produto_cod_integracao: nullIfEmpty(r.PRD_ModeloProdutoCodIntegracao),
      prd_modelo_produto: nullIfEmpty(r.PRD_ModeloProduto),
      prd_condicao_produto: nullIfEmpty(r.PRD_CondicaoProduto),
      prd_qtde: r.PRD_Qtde,
      prd_vlr_unitario: r.PRD_VlrUnitario,
      ngo_probabilidade: r.NGO_Probabilidade,
      ngo_obs_negocio: nullIfEmpty(r.NGO_ObsNegocio),
      ngo_id_funil: nullIfEmpty(r.NGO_IdFunil),
      ngo_funil_cod_integracao: nullIfEmpty(r.NGO_FunilCodIntegracao),
      ngo_funil: nullIfEmpty(r.NGO_Funil),
      ngo_id_etapa: nullIfEmpty(r.NGO_IdEtapa),
      ngo_etapa_cod_integracao: nullIfEmpty(r.NGO_EtapaCodIntegracao),
      ngo_etapa: nullIfEmpty(r.NGO_Etapa),
      ngo_evento: nullIfEmpty(r.NGO_Evento),
      ngo_conclusao: nullIfEmpty(r.NGO_Conclusao),
      ngo_motivo_ganho_cod_integracao: nullIfEmpty(r.NGO_MotivoGanhoCodIntegracao),
      ngo_motivo_ganho: nullIfEmpty(r.NGO_MotivoGanho),
      ngo_obs_motivo_ganho: nullIfEmpty(r.NGO_ObsMotivoGanho),
      ngo_motivo_perda_cod_integracao: nullIfEmpty(r.NGO_MotivoPerdaCodIntegracao),
      ngo_prioridade: nullIfEmpty(r.NGO_Prioridade),
      ngo_data_previsao: nullIfEmpty(r.NGO_DataPrevisao),
      ngo_campanha: nullIfEmpty(r.NGO_Campanha),
      ngo_motivo_perda: nullIfEmpty(r.NGO_MotivoPerda),
      ngo_obs_motivo_perda: nullIfEmpty(r.NGO_ObsMotivoPerda),
      mpr_dsc_motivo_perda: nullIfEmpty(r.MPR_DscMotivoPerda),
      mpr_dsc_motivo_perda_detalhe: nullIfEmpty(r.MPR_DscMotivoPerdaDetalhe),
      mpr_produto_perda_marca: nullIfEmpty(r.MPR_ProdutoPerdaMarca),
      mpr_produto_perda_grupo: nullIfEmpty(r.MPR_ProdutoPerdaGrupo),
      mpr_produto_perda_modelo: nullIfEmpty(r.MPR_ProdutoPerdaModelo),
      mpr_produto_vlr_concorrencia: nullIfEmpty(r.MPR_ProdutoVlrConcorrencia),
      mpr_motivo_observacao: nullIfEmpty(r.MPR_MotivoObservacao),
      mpp_dsc_motivo_perda: nullIfEmpty(r.MPP_DscMotivoPerda),
      mpp_dsc_motivo_perda_detalhe: nullIfEmpty(r.MPP_DscMotivoPerdaDetalhe),
      mpp_produto_perda_marca: nullIfEmpty(r.MPP_ProdutoPerdaMarca),
      mpp_produto_perda_grupo: nullIfEmpty(r.MPP_ProdutoPerdaGrupo),
      mpp_produto_perda_modelo: nullIfEmpty(r.MPP_ProdutoPerdaModelo),
      mpp_produto_vlr_concorrencia: nullIfEmpty(r.MPP_ProdutoVlrConcorrencia),
      mpp_motivo_observacao: nullIfEmpty(r.MPP_MotivoObservacao),
      orc_valor: r.ORC_Valor,
      orc_tipo: nullIfEmpty(r.ORC_Tipo),
      orc_banco: nullIfEmpty(r.ORC_Banco),
      orc_observacao: nullIfEmpty(r.ORC_Observacao),
      usa_maquina: nullIfEmpty(r.USA_Maquina),
      usa_valor: r.USA_Valor,
      usa_estado_cod_integracao: nullIfEmpty(r.USA_EstadoCodIntegracao),
      usa_estado_descricao: nullIfEmpty(r.USA_EstadoDescricao),
      cli_id_cliente: nullIfEmpty(r.CLI_IdCliente),
      cli_codigo_cliente: nullIfEmpty(r.CLI_CodigoCliente),
      cli_loja_cliente_cod_integracao: nullIfEmpty(r.CLI_LojaClienteCodIntegracao),
      cli_cnpj_cpf: nullIfEmpty(r.CLI_CNPJ_CPF),
      cli_tipo_cliente: nullIfEmpty(r.CLI_TipoCliente),
      cli_nome: nullIfEmpty(r.CLI_Nome),
      cli_telefone: nullIfEmpty(r.CLI_Telefone),
      cli_email: nullIfEmpty(r.CLI_Email),
      cli_cidade: nullIfEmpty(r.CLI_Cidade),
      cli_uf: nullIfEmpty(r.CLI_UF),
      ngo_vendedores: nullIfEmpty(r.NGO_Vendedores),
      aco_data_agenda_ultima_acao: nullIfEmpty(r.ACO_DataAgendaUltimaAcao),
      aco_obs_inicio_ultima_acao: nullIfEmpty(r.ACO_ObsInicioUltimaAcao),
      aco_obs_fim_ultima_acao: nullIfEmpty(r.ACO_ObsFimUltimaAcao),
      aco_status_ultima_acao: nullIfEmpty(r.ACO_StatusUltimaAcao),
      ngo_data_primeiro_contato: nullIfEmpty(r.NGO_DataPrimeiroContato),
      ngo_data_fechamento: nullIfEmpty(r.NGO_DataFechamento),
      ngo_data_cadastro: nullIfEmpty(r.NGO_DataCadastro),
      ngo_data_atualizacao: nullIfEmpty(r.NGO_DataAtualizacao),
      ngo_ciclo_vendas: r.NGO_CicloVendas,
      ngo_qtd_acoes: r.NGO_QtdAcoes,
      dth_registro: nullIfEmpty(r.dthRegistro),
    }),
    strategy: "incremental",
    watermarkCol: "NGO_DataAtualizacao",
    overlapHours: 2,
    conflictKey: "prd_id_negocio_x_produto",
  },

  "VW_Ceres_CRM_Pedidos": {
    table: "crm_pedidos",
    sqlColumns: [
      "EMP_idEmpresa", "EMP_CodFilial", "EMP_Nome", "EMP_CNPJ", "EMP_Cidade", "EMP_UF",
      "NGO_CodigoIntegracao", "NGO_Numero",
      "CLI_idCliente", "CLI_CodigoCliente", "CLI_CNPJ_CPF", "CLI_Nome", "CLI_Telefone", "CLI_Telefone2", "CLI_Email",
      "PDO_CodigoInterno", "PDO_NroPedido", "PDO_SituacaoPedido", "PDO_DthPedido",
      "PDO_VlrPedido", "PDO_ObsPedido", "PDO_EnderecoFaturamento", "PDO_CidadeUFFaturamento",
      "PDO_Frete", "PDO_EnderecoEntrega", "PDO_CidadeUFEntrega",
      "USR_idUsuarioVendedor", "USR_CodUsuarioVendedor", "PDO_Vendedor",
      "PDO_VlrRecursoProprio", "PDO_VlrFinanciado",
      "PDO_FinanciamentoModalidadeNome", "PDO_FiananciamentoBanco", "PDO_DthAprovacao",
      "USR_idUsuarioAprovador", "USR_CodUsuarioAprovador", "PDO_Aprovador",
      "PDO_DthAssinaturaCliente", "dthRegistro",
    ],
    mapRow: (r) => ({
      emp_id_empresa: r.EMP_idEmpresa,
      emp_cod_filial: r.EMP_CodFilial,
      emp_nome: r.EMP_Nome,
      emp_cnpj: r.EMP_CNPJ,
      emp_cidade: r.EMP_Cidade,
      emp_uf: r.EMP_UF,
      ngo_codigo_integracao: r.NGO_CodigoIntegracao,
      ngo_numero: r.NGO_Numero,
      cli_id_cliente: r.CLI_idCliente,
      cli_codigo_cliente: r.CLI_CodigoCliente,
      cli_cnpj_cpf: r.CLI_CNPJ_CPF,
      cli_nome: r.CLI_Nome,
      cli_telefone: nullIfEmpty(r.CLI_Telefone),
      cli_telefone2: nullIfEmpty(r.CLI_Telefone2),
      cli_email: nullIfEmpty(r.CLI_Email),
      pdo_codigo_interno: r.PDO_CodigoInterno,
      pdo_nro_pedido: r.PDO_NroPedido,
      pdo_situacao_pedido: nullIfEmpty(r.PDO_SituacaoPedido),
      pdo_dth_pedido: nullIfEmpty(r.PDO_DthPedido),
      pdo_vlr_pedido: r.PDO_VlrPedido,
      pdo_obs_pedido: nullIfEmpty(r.PDO_ObsPedido),
      pdo_endereco_faturamento: nullIfEmpty(r.PDO_EnderecoFaturamento),
      pdo_cidade_uf_faturamento: nullIfEmpty(r.PDO_CidadeUFFaturamento),
      pdo_frete: r.PDO_Frete,
      pdo_endereco_entrega: nullIfEmpty(r.PDO_EnderecoEntrega),
      pdo_cidade_uf_entrega: nullIfEmpty(r.PDO_CidadeUFEntrega),
      usr_id_usuario_vendedor: r.USR_idUsuarioVendedor,
      usr_cod_usuario_vendedor: r.USR_CodUsuarioVendedor,
      pdo_vendedor: nullIfEmpty(r.PDO_Vendedor),
      pdo_vlr_recurso_proprio: r.PDO_VlrRecursoProprio,
      pdo_vlr_financiado: r.PDO_VlrFinanciado,
      pdo_financiamento_modalidade_nome: nullIfEmpty(r.PDO_FinanciamentoModalidadeNome),
      pdo_financiamento_banco: nullIfEmpty(r.PDO_FiananciamentoBanco),
      pdo_dth_aprovacao: nullIfEmpty(r.PDO_DthAprovacao),
      usr_id_usuario_aprovador: r.USR_idUsuarioAprovador,
      usr_cod_usuario_aprovador: r.USR_CodUsuarioAprovador,
      pdo_aprovador: nullIfEmpty(r.PDO_Aprovador),
      pdo_dth_assinatura_cliente: nullIfEmpty(r.PDO_DthAssinaturaCliente),
      dth_registro: nullIfEmpty(r.dthRegistro),
    }),
    strategy: "incremental",
    watermarkCol: "dthRegistro",
    overlapHours: 2,
    conflictKey: "pdo_codigo_interno",
  },

  "VW_Ceres_CRM_PedidosItem": {
    table: "crm_pedidos_item",
    sqlColumns: [
      "PDO_CodigoInterno", "PDO_ItemId", "PDO_ItemIdGrupo", "PDO_ItemGrupo",
      "PDO_ItemIdMarca", "PDO_ItemMarca", "PDO_ItemIdModelo", "PDO_ItemModelo",
      "PDO_ItemIdProduto", "PDO_ItemDescricao", "PDO_ItemObs",
      "PDO_ItemQtde", "PDO_ItemVlrUnitario", "dthRegistro",
    ],
    mapRow: (r) => ({
      pdo_codigo_interno: r.PDO_CodigoInterno,
      pdo_item_id: r.PDO_ItemId,
      pdo_item_id_grupo: r.PDO_ItemIdGrupo,
      pdo_item_grupo: nullIfEmpty(r.PDO_ItemGrupo),
      pdo_item_id_marca: r.PDO_ItemIdMarca,
      pdo_item_marca: nullIfEmpty(r.PDO_ItemMarca),
      pdo_item_id_modelo: r.PDO_ItemIdModelo,
      pdo_item_modelo: nullIfEmpty(r.PDO_ItemModelo),
      pdo_item_id_produto: r.PDO_ItemIdProduto,
      pdo_item_descricao: nullIfEmpty(r.PDO_ItemDescricao),
      pdo_item_obs: nullIfEmpty(r.PDO_ItemObs),
      pdo_item_qtde: r.PDO_ItemQtde,
      pdo_item_vlr_unitario: r.PDO_ItemVlrUnitario,
      dth_registro: nullIfEmpty(r.dthRegistro),
    }),
    strategy: "incremental",
    watermarkCol: "dthRegistro",
    overlapHours: 2,
    conflictKey: "pdo_item_id",
  },

  "VW_Ceres_CRM_CarteiraClientes": {
    table: "crm_carteira_clientes",
    sqlColumns: [
      "EMP_CodFilial", "EMP_CNPJ", "EMP_Nome", "EMP_Cidade", "EMP_UF",
      "USR_idUsuario", "USR_NomeUsuario", "USR_Codigo",
      "CLI_Nome", "CLI_CNPJ_CPF", "CLI_CodigoCliente", "CLI_idCliente",
      "CLI_Segmento", "CLI_Endereco", "CLI_CEP", "CLI_Telefone", "CLI_Telefone2",
      "CLI_Email", "CLI_Cidade", "CLI_UF", "CLI_Lat", "CLI_Lon",
      "CLI_Prospect", "CLI_TipoCliente", "CLI_DataCadastro", "CLI_DataAtualizacao",
      "dthRegistro",
    ],
    mapRow: (r) => ({
      emp_cod_filial: r.EMP_CodFilial,
      emp_cnpj: r.EMP_CNPJ,
      emp_nome: r.EMP_Nome,
      emp_cidade: r.EMP_Cidade,
      emp_uf: r.EMP_UF,
      usr_id_usuario: r.USR_idUsuario,
      usr_nome_usuario: r.USR_NomeUsuario,
      usr_codigo: r.USR_Codigo,
      cli_nome: r.CLI_Nome,
      cli_cnpj_cpf: r.CLI_CNPJ_CPF,
      cli_codigo_cliente: r.CLI_CodigoCliente,
      cli_id_cliente: r.CLI_idCliente,
      cli_segmento: nullIfEmpty(r.CLI_Segmento),
      cli_endereco: nullIfEmpty(r.CLI_Endereco),
      cli_cep: nullIfEmpty(r.CLI_CEP),
      cli_telefone: nullIfEmpty(r.CLI_Telefone),
      cli_telefone2: nullIfEmpty(r.CLI_Telefone2),
      cli_email: nullIfEmpty(r.CLI_Email),
      cli_cidade: nullIfEmpty(r.CLI_Cidade),
      cli_uf: nullIfEmpty(r.CLI_UF),
      cli_lat: nullIfEmpty(r.CLI_Lat),
      cli_lon: nullIfEmpty(r.CLI_Lon),
      cli_prospect: nullIfEmpty(r.CLI_Prospect),
      cli_tipo_cliente: nullIfEmpty(r.CLI_TipoCliente),
      cli_data_cadastro: nullIfEmpty(r.CLI_DataCadastro),
      cli_data_atualizacao: nullIfEmpty(r.CLI_DataAtualizacao),
      dth_registro: nullIfEmpty(r.dthRegistro),
    }),
    strategy: "incremental",
    watermarkCol: "dthRegistro",
    overlapHours: 2,
    conflictKey: "cli_id_cliente,usr_id_usuario",
  },

  "VW_Ceres_CRM_Acoes": {
    table: "crm_acoes",
    sqlColumns: [
      "ACO_IdAcao", "ACO_CodigoAcao",
      "EMP_CodFilial", "EMP_CNPJ", "EMP_Nome", "EMP_Cidade", "EMP_UF",
      "CLI_Nome", "CLI_CNPJ_CPF", "CLI_CodigoCliente", "CLI_IdCliente",
      "ACO_TipoContato", "ACO_TipoAcao",
      "USR_IdUsuario", "USR_CodigoUsuario", "ACO_Vendedor",
      "ACO_DthAgendaInicio", "ACO_DthAgendaTermino",
      "ACO_AtividadeAserExecutada", "ACO_AtividadeExecutada",
      "ACO_Status", "ACO_DthAtualizacao", "ACO_Lat", "ACO_Lon",
      "ACO_Contato", "ACO_DthAbertura", "ACO_DthGeolocalizacao",
      "ACO_AcaoValida", "ACO_AcaoReagendada", "ACO_DthConclusao",
      "NGO_NroNegocio", "dthRegistro",
    ],
    mapRow: (r) => ({
      aco_id_acao: r.ACO_IdAcao,
      aco_codigo_acao: r.ACO_CodigoAcao,
      emp_cod_filial: r.EMP_CodFilial,
      emp_cnpj: r.EMP_CNPJ,
      emp_nome: r.EMP_Nome,
      emp_cidade: nullIfEmpty(r.EMP_Cidade),
      emp_uf: nullIfEmpty(r.EMP_UF),
      cli_nome: nullIfEmpty(r.CLI_Nome),
      cli_cnpj_cpf: nullIfEmpty(r.CLI_CNPJ_CPF),
      cli_codigo_cliente: nullIfEmpty(r.CLI_CodigoCliente),
      cli_id_cliente: nullIfEmpty(r.CLI_IdCliente),
      aco_tipo_contato: nullIfEmpty(r.ACO_TipoContato),
      aco_tipo_acao: nullIfEmpty(r.ACO_TipoAcao),
      usr_id_usuario: nullIfEmpty(r.USR_IdUsuario),
      usr_codigo_usuario: nullIfEmpty(r.USR_CodigoUsuario),
      aco_vendedor: nullIfEmpty(r.ACO_Vendedor),
      aco_dth_agenda_inicio: nullIfEmpty(r.ACO_DthAgendaInicio),
      aco_dth_agenda_termino: nullIfEmpty(r.ACO_DthAgendaTermino),
      aco_atividade_a_executar: nullIfEmpty(r.ACO_AtividadeAserExecutada),
      aco_atividade_executada: nullIfEmpty(r.ACO_AtividadeExecutada),
      aco_status: nullIfEmpty(r.ACO_Status),
      aco_dth_atualizacao: nullIfEmpty(r.ACO_DthAtualizacao),
      aco_lat: nullIfEmpty(r.ACO_Lat),
      aco_lon: nullIfEmpty(r.ACO_Lon),
      aco_contato: nullIfEmpty(r.ACO_Contato),
      aco_dth_abertura: nullIfEmpty(r.ACO_DthAbertura),
      aco_dth_geolocalizacao: nullIfEmpty(r.ACO_DthGeolocalizacao),
      aco_acao_valida: nullIfEmpty(r.ACO_AcaoValida),
      aco_acao_reagendada: nullIfEmpty(r.ACO_AcaoReagendada),
      aco_dth_conclusao: nullIfEmpty(r.ACO_DthConclusao),
      ngo_nro_negocio: nullIfEmpty(r.NGO_NroNegocio),
      dth_registro: nullIfEmpty(r.dthRegistro),
    }),
    strategy: "incremental",
    watermarkCol: "ACO_DthAtualizacao",
    overlapHours: 2,
    conflictKey: "aco_id_acao",
  },

  "VW_Ceres_CRM_Negocios_Etapas": {
    table: "crm_funil_etapa",
    sqlColumns: [
      "EMP_IdEmpresa", "EMP_CodFilial", "EMP_Nome", "EMP_CNPJ", "EMP_Cidade", "EMP_UF",
      "NGO_CodigoIntegracao", "NGO_Numero",
      "Funil_dsc", "Etapa_dscStatusNegocio", "FNE_dthInicioEtapa", "FNE_dthTerminoEtapa",
      "FNE_DuracaoDias", "dthRegistro",
    ],
    mapRow: (r) => ({
      emp_id_empresa: r.EMP_IdEmpresa,
      emp_cod_filial: r.EMP_CodFilial,
      emp_nome: r.EMP_Nome,
      emp_cnpj: r.EMP_CNPJ,
      emp_cidade: nullIfEmpty(r.EMP_Cidade),
      emp_uf: nullIfEmpty(r.EMP_UF),
      ngo_codigo_integracao: r.NGO_CodigoIntegracao,
      ngo_numero: r.NGO_Numero,
      funil_dsc: nullIfEmpty(r.Funil_dsc),
      etapa_dsc_status_negocio: nullIfEmpty(r.Etapa_dscStatusNegocio),
      fne_dth_inicio_etapa: nullIfEmpty(r.FNE_dthInicioEtapa),
      fne_dth_termino_etapa: nullIfEmpty(r.FNE_dthTerminoEtapa),
      fne_duracao_dias: r.FNE_DuracaoDias,
      dth_registro: nullIfEmpty(r.dthRegistro),
    }),
    strategy: "incremental",
    watermarkCol: "dthRegistro",
    overlapHours: 2,
    conflictKey: "ngo_numero",
  },

  "VW_Ceres_Usuario": {
    table: "usuarios",
    sqlColumns: [
      "USR_idUsuario", "USR_CPF", "USR_nomeUsuario", "USR_Login",
      "USR_TipoUsuario", "USR_dscTipoUsuario", "USR_idEmpresa",
      "USR_Email", "USR_idLicenca", "USR_dthRegistro", "USR_CodUsuario",
      "EMP_idEmpresa", "EMP_nome", "EMP_cidade", "EMP_CodFilial",
      "dthRegistro",
    ],
    mapRow: (r) => ({
      usr_id_usuario: r.USR_idUsuario,
      usr_cpf: nullIfEmpty(r.USR_CPF),
      usr_nome_usuario: r.USR_nomeUsuario,
      usr_login: nullIfEmpty(r.USR_Login),
      usr_tipo_usuario: r.USR_TipoUsuario,
      usr_dsc_tipo_usuario: nullIfEmpty(r.USR_dscTipoUsuario),
      usr_id_empresa: r.USR_idEmpresa,
      usr_email: nullIfEmpty(r.USR_Email),
      usr_id_licenca: r.USR_idLicenca,
      usr_dth_registro: nullIfEmpty(r.USR_dthRegistro),
      usr_cod_usuario: r.USR_CodUsuario,
      emp_id_empresa: r.EMP_idEmpresa,
      emp_nome: nullIfEmpty(r.EMP_nome),
      emp_cidade: nullIfEmpty(r.EMP_cidade),
      emp_cod_filial: r.EMP_CodFilial,
      dth_registro: nullIfEmpty(r.dthRegistro),
    }),
    strategy: "incremental",
    watermarkCol: "dthRegistro",
    overlapHours: 2,
    conflictKey: "usr_id_usuario",
  },

  "VW_Ceres_OrdemServico": {
    table: "ordens_servico",
    sqlColumns: [
      "EMP_CodFilial", "EMP_CNPJ", "EMP_Nome", "EMP_Cidade", "EMP_UF",
      "OS_idOS", "OS_nrOS", "OS_idCliente", "OS_idEquipamento",
      "OS_dtAvaria", "OS_idSituacaoOS", "OS_dthEncerramento",
      "SIT_codSituacaoOS", "SIT_dscSituacaoOS",
      "OS_dscProblema", "OS_dthAbertura", "OS_fStatus",
      "OS_nrOSGeradora", "OS_tempoEstimado",
      "OS_idAreaOperacao", "ARE_codAreaOperacao",
      "OS_idTipoOS", "TOS_codTipoOS",
      "OS_dthPrevisaoAtendimento", "OS_ContatoCliente", "OS_ContatoTelefone",
      "CLI_idEmpresa", "CLI_Nome", "CLI_CodigoCliente", "CLI_CNPJ_CPF",
      "dthRegistro",
    ],
    mapRow: (r) => ({
      emp_cod_filial: r.EMP_CodFilial,
      emp_cnpj: r.EMP_CNPJ,
      emp_nome: r.EMP_Nome,
      emp_cidade: r.EMP_Cidade,
      emp_uf: r.EMP_UF,
      os_id_os: r.OS_idOS,
      os_nr_os: r.OS_nrOS,
      os_id_cliente: r.OS_idCliente,
      os_id_equipamento: r.OS_idEquipamento,
      os_dt_avaria: nullIfEmpty(r.OS_dtAvaria),
      os_id_situacao_os: r.OS_idSituacaoOS,
      os_dth_encerramento: nullIfEmpty(r.OS_dthEncerramento),
      sit_cod_situacao_os: r.SIT_codSituacaoOS,
      sit_dsc_situacao_os: r.SIT_dscSituacaoOS,
      os_dsc_problema: nullIfEmpty(r.OS_dscProblema),
      os_dth_abertura: nullIfEmpty(r.OS_dthAbertura),
      os_f_status: r.OS_fStatus,
      os_nr_os_geradora: nullIfEmpty(r.OS_nrOSGeradora),
      os_tempo_estimado: r.OS_tempoEstimado,
      os_id_area_operacao: r.OS_idAreaOperacao,
      are_cod_area_operacao: r.ARE_codAreaOperacao,
      os_id_tipo_os: r.OS_idTipoOS,
      tos_cod_tipo_os: r.TOS_codTipoOS,
      os_dth_previsao_atendimento: nullIfEmpty(r.OS_dthPrevisaoAtendimento),
      os_contato_cliente: nullIfEmpty(r.OS_ContatoCliente),
      os_contato_telefone: nullIfEmpty(r.OS_ContatoTelefone),
      cli_id_empresa: r.CLI_idEmpresa,
      cli_nome: r.CLI_Nome,
      cli_codigo_cliente: r.CLI_CodigoCliente,
      cli_cnpj_cpf: r.CLI_CNPJ_CPF,
      dth_registro: nullIfEmpty(r.dthRegistro),
    }),
    strategy: "incremental",
    watermarkCol: "dthRegistro",
    overlapHours: 2,
    conflictKey: "os_nr_os",
  },

  "VW_Ceres_CRM_ClienteParqueMaquinas": {
    table: "cliente_parque_maquinas",
    sqlColumns: [
      "CLI_Nome", "CLI_CNPJ_CPF", "CLI_CodigoCliente", "CLI_idCliente",
      "CLI_Prospect", "CLI_Segmento",
      "PQM_id", "PQM_CodigoIntegracao", "PQM_Grupo", "PQM_CodigoProdutoGrupo",
      "PQM_Marca", "PQM_CodigoProdutoMarca", "PQM_Modelo", "PQM_CodigoProdutoModelo",
      "PQM_QtdMaquinas", "PQM_Ano", "PQM_Chassi", "PQM_Serie",
      "PQM_Horimetro", "PQM_Descricao", "PQM_Observacao", "PQM_dthRegistro",
      "dthRegistro",
    ],
    mapRow: (r) => ({
      cli_nome: r.CLI_Nome,
      cli_cnpj_cpf: r.CLI_CNPJ_CPF,
      cli_codigo_cliente: r.CLI_CodigoCliente,
      cli_id_cliente: r.CLI_idCliente,
      cli_prospect: r.CLI_Prospect,
      cli_segmento: r.CLI_Segmento,
      pqm_id: r.PQM_id,
      pqm_codigo_integracao: r.PQM_CodigoIntegracao,
      pqm_grupo: r.PQM_Grupo,
      pqm_codigo_produto_grupo: r.PQM_CodigoProdutoGrupo,
      pqm_marca: r.PQM_Marca,
      pqm_codigo_produto_marca: r.PQM_CodigoProdutoMarca,
      pqm_modelo: r.PQM_Modelo,
      pqm_codigo_produto_modelo: r.PQM_CodigoProdutoModelo,
      pqm_qtd_maquinas: r.PQM_QtdMaquinas,
      pqm_ano: r.PQM_Ano,
      pqm_chassi: nullIfEmpty(r.PQM_Chassi),
      pqm_serie: nullIfEmpty(r.PQM_Serie),
      pqm_horimetro: nullIfEmpty(r.PQM_Horimetro),
      pqm_descricao: nullIfEmpty(r.PQM_Descricao),
      pqm_observacao: nullIfEmpty(r.PQM_Observacao),
      pqm_dth_registro: nullIfEmpty(r.PQM_dthRegistro),
      dth_registro: nullIfEmpty(r.dthRegistro),
    }),
    strategy: "incremental",
    watermarkCol: "dthRegistro",
    overlapHours: 2,
    conflictKey: "pqm_id",
  },

  "VW_Ceres_TecnicoTempo": {
    table: "tecnico_tempo",
    sqlColumns: [
      "EMP_CodFilial", "EMP_CNPJ", "EMP_Nome", "EMP_Cidade", "EMP_UF",
      "USR_idUsuario", "USR_codUsuario", "USR_nomeUsuario",
      "TMP_Dia", "TMP_DiaSemana", "TMP_TempoDisponivel",
      "TMP_DuracaoAtendimento", "TMP_DuracaoDeslocamento", "TMP_KmRodado",
      "TMP_TempoOcioso", "TMP_TempoExtra", "TMP_dthProcessamento", "dthRegistro",
    ],
    mapRow: (r) => ({
      emp_cod_filial: r.EMP_CodFilial,
      emp_cnpj: r.EMP_CNPJ,
      emp_nome: r.EMP_Nome,
      emp_cidade: nullIfEmpty(r.EMP_Cidade),
      emp_uf: nullIfEmpty(r.EMP_UF),
      usr_id_usuario: r.USR_idUsuario,
      usr_cod_usuario: r.USR_codUsuario,
      usr_nome_usuario: r.USR_nomeUsuario,
      tmp_dia: nullIfEmpty(r.TMP_Dia),
      tmp_dia_semana: nullIfEmpty(r.TMP_DiaSemana),
      tmp_tempo_disponivel: r.TMP_TempoDisponivel,
      tmp_duracao_atendimento: r.TMP_DuracaoAtendimento,
      tmp_duracao_deslocamento: r.TMP_DuracaoDeslocamento,
      tmp_km_rodado: r.TMP_KmRodado,
      tmp_tempo_ocioso: r.TMP_TempoOcioso,
      tmp_tempo_extra: r.TMP_TempoExtra,
      tmp_dth_processamento: nullIfEmpty(r.TMP_dthProcessamento),
      dth_registro: nullIfEmpty(r.dthRegistro),
    }),
    strategy: "incremental",
    watermarkCol: "dthRegistro",
    overlapHours: 2,
    conflictKey: "usr_id_usuario,tmp_dia",
  },

  "VW_Ceres_Agenda": {
    table: "agenda_servico",
    sqlColumns: [
      "EMP_CodFilial", "EMP_idEmpresa", "OS_idOS", "OS_nrOS", "OS_fStatus",
      "OS_idCliente", "CLI_CodigoCliente", "CLI_Nome", "CLI_CNPJ_CPF",
      "ATD_idAtendimento", "USR_idUsuario", "USR_codUsuario", "USR_nomeUsuario",
      "AGE_idAgenda", "AGE_fStatus", "AGE_dthPrevisaoInicio", "AGE_dthPrevisaoFim",
      "TPS_codServicoDeslocamento", "TPS_dscTipoServicoDeslocamento",
      "TPS_codServicoAtendimento", "TPS_dscTipoServicoAtendimento", "dthRegistro",
    ],
    mapRow: (r) => ({
      emp_cod_filial: r.EMP_CodFilial,
      emp_id_empresa: r.EMP_idEmpresa,
      os_id_os: r.OS_idOS,
      os_nr_os: r.OS_nrOS,
      os_f_status: nullIfEmpty(r.OS_fStatus),
      os_id_cliente: r.OS_idCliente,
      cli_codigo_cliente: r.CLI_CodigoCliente,
      cli_nome: nullIfEmpty(r.CLI_Nome),
      cli_cnpj_cpf: nullIfEmpty(r.CLI_CNPJ_CPF),
      atd_id_atendimento: r.ATD_idAtendimento,
      usr_id_usuario: r.USR_idUsuario,
      usr_cod_usuario: r.USR_codUsuario,
      usr_nome_usuario: r.USR_nomeUsuario,
      age_id_agenda: r.AGE_idAgenda,
      age_f_status: nullIfEmpty(r.AGE_fStatus),
      age_dth_previsao_inicio: nullIfEmpty(r.AGE_dthPrevisaoInicio),
      age_dth_previsao_fim: nullIfEmpty(r.AGE_dthPrevisaoFim),
      tps_cod_servico_deslocamento: nullIfEmpty(r.TPS_codServicoDeslocamento),
      tps_dsc_tipo_servico_deslocamento: nullIfEmpty(r.TPS_dscTipoServicoDeslocamento),
      tps_cod_servico_atendimento: nullIfEmpty(r.TPS_codServicoAtendimento),
      tps_dsc_tipo_servico_atendimento: nullIfEmpty(r.TPS_dscTipoServicoAtendimento),
      dth_registro: nullIfEmpty(r.dthRegistro),
    }),
    strategy: "incremental",
    watermarkCol: "dthRegistro",
    overlapHours: 2,
    conflictKey: "age_id_agenda",
  },

  "VW_Ceres_AtendimentoOS": {
    table: "atendimentos_os",
    sqlColumns: [
      "EMP_CodFilial", "EMP_CNPJ", "EMP_Nome", "EMP_Cidade", "EMP_UF",
      "OS_idOS", "OS_nrOS", "OS_fstatus", "OS_idCliente",
      "CLI_CodigoCliente", "CLI_Nome", "CLI_CNPJ_CPF",
      "ATD_idAtendimento", "USR_codUsuario", "USR_nomeUsuario",
      "ATD_dscCausa", "ATD_partNumberCausadora", "ATD_dscSolucao",
      "ATD_ContadoCliente", "ATD_ContatoTelefone", "ATD_dthRegistro",
      "ATD_fStatus", "ATD_Ano", "ATD_Mes", "ATD_Horimetro", "ATD_dscOpcional",
      "ATD_DuracaoAtendimento", "ATD_DthPrimeiroOcorrencia", "ATD_DthUltimaOcorrencia",
      "dthRegistro",
    ],
    mapRow: (r) => ({
      emp_cod_filial: r.EMP_CodFilial,
      emp_cnpj: r.EMP_CNPJ,
      emp_nome: r.EMP_Nome,
      emp_cidade: nullIfEmpty(r.EMP_Cidade),
      emp_uf: nullIfEmpty(r.EMP_UF),
      os_id_os: r.OS_idOS,
      os_nr_os: r.OS_nrOS,
      os_f_status: nullIfEmpty(r.OS_fstatus),
      os_id_cliente: r.OS_idCliente,
      cli_codigo_cliente: r.CLI_CodigoCliente,
      cli_nome: nullIfEmpty(r.CLI_Nome),
      cli_cnpj_cpf: nullIfEmpty(r.CLI_CNPJ_CPF),
      atd_id_atendimento: r.ATD_idAtendimento,
      usr_cod_usuario: r.USR_codUsuario,
      usr_nome_usuario: r.USR_nomeUsuario,
      atd_dsc_causa: nullIfEmpty(r.ATD_dscCausa),
      atd_part_number_causadora: nullIfEmpty(r.ATD_partNumberCausadora),
      atd_dsc_solucao: nullIfEmpty(r.ATD_dscSolucao),
      atd_contado_cliente: nullIfEmpty(r.ATD_ContadoCliente),
      atd_contato_telefone: nullIfEmpty(r.ATD_ContatoTelefone),
      atd_dth_registro: nullIfEmpty(r.ATD_dthRegistro),
      atd_f_status: nullIfEmpty(r.ATD_fStatus),
      atd_ano: r.ATD_Ano,
      atd_mes: r.ATD_Mes,
      atd_horimetro: nullIfEmpty(r.ATD_Horimetro),
      atd_dsc_opcional: nullIfEmpty(r.ATD_dscOpcional),
      atd_duracao_atendimento: r.ATD_DuracaoAtendimento,
      atd_dth_primeiro_ocorrencia: nullIfEmpty(r.ATD_DthPrimeiroOcorrencia),
      atd_dth_ultima_ocorrencia: nullIfEmpty(r.ATD_DthUltimaOcorrencia),
      dth_registro: nullIfEmpty(r.dthRegistro),
    }),
    strategy: "incremental",
    watermarkCol: "dthRegistro",
    overlapHours: 2,
    conflictKey: "atd_id_atendimento",
  },

  "VW_Ceres_Ocorrencias": {
    table: "ocorrencias_os",
    sqlColumns: [
      "OSE_idOSOCr", "OSE_idOS", "OS_nrOS", "OSE_idOcorrencia",
      "OSE_dscOcorrencia", "OSE_idUsuario", "OSE_dthOcorrencia",
      "OSE_observacao", "OSE_Latitude", "OSE_Longitude", "OS_KM",
      "OSE_idAgenda", "OSE_idSituacaoOcorrencia", "OSE_dscSituacaoOcorrencia",
      "OSE_idTipoOrigem", "OSE_dthOriginal", "OSE_idMotivoPausa",
      "OSE_dscMotivoPausa", "USR_nomeUsuario", "USR_codUsuario",
      "EMP_CodFilial", "dthRegistro",
    ],
    mapRow: (r) => ({
      ose_id_os_ocr: r.OSE_idOSOCr,
      ose_id_os: r.OSE_idOS,
      os_nr_os: r.OS_nrOS,
      ose_id_ocorrencia: r.OSE_idOcorrencia,
      ose_dsc_ocorrencia: nullIfEmpty(r.OSE_dscOcorrencia),
      ose_id_usuario: r.OSE_idUsuario,
      ose_dth_ocorrencia: nullIfEmpty(r.OSE_dthOcorrencia),
      ose_observacao: nullIfEmpty(r.OSE_observacao),
      ose_latitude: nullIfEmpty(r.OSE_Latitude),
      ose_longitude: nullIfEmpty(r.OSE_Longitude),
      os_km: nullIfEmpty(r.OS_KM),
      ose_id_agenda: nullIfEmpty(r.OSE_idAgenda),
      ose_id_situacao_ocorrencia: nullIfEmpty(r.OSE_idSituacaoOcorrencia),
      ose_dsc_situacao_ocorrencia: nullIfEmpty(r.OSE_dscSituacaoOcorrencia),
      ose_id_tipo_origem: nullIfEmpty(r.OSE_idTipoOrigem),
      ose_dth_original: nullIfEmpty(r.OSE_dthOriginal),
      ose_id_motivo_pausa: nullIfEmpty(r.OSE_idMotivoPausa),
      ose_dsc_motivo_pausa: nullIfEmpty(r.OSE_dscMotivoPausa),
      usr_nome_usuario: nullIfEmpty(r.USR_nomeUsuario),
      usr_cod_usuario: nullIfEmpty(r.USR_codUsuario),
      emp_cod_filial: r.EMP_CodFilial,
      dth_registro: nullIfEmpty(r.dthRegistro),
    }),
    strategy: "incremental",
    watermarkCol: "dthRegistro",
    overlapHours: 2,
    conflictKey: "ose_id_os_ocr",
  },
};

const ALL_VIEWS = Object.keys(VIEW_CONFIG);
const BATCH_SIZE = 500;

// =============================================================================
// Retry Configuration (QA approved: 1 retry, 10s backoff — avoids server overload)
// =============================================================================

const RETRY_CONFIG = {
  maxRetries: 1,
  backoffMs: 10_000, // 10 seconds
  timeoutMs: 60_000,  // 60 seconds (was 240s)
};

// =============================================================================
// SQL Server Query Execution with retry + timeout
// =============================================================================

async function execQueryWithRetry(
  sql: string,
  viewName: string,
): Promise<Record<string, unknown>[]> {
  const { Connection, Request } = await import("npm:tedious@19");
  const config = getSqlServerConfig();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    const attemptStart = Date.now();
    const attemptLabel = attempt === 0 ? "initial" : `retry:${attempt}`;

    try {
      const result = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const connection = new Connection({
          server: config.server,
          authentication: {
            type: "default",
            options: { userName: config.user, password: config.password },
          },
          options: {
            database: config.database,
            port: config.port,
            encrypt: false,
            trustServerCertificate: true,
            connectTimeout: RETRY_CONFIG.timeoutMs,
            requestTimeout: RETRY_CONFIG.timeoutMs,
            rowCollectionOnRequestCompletion: true,
          },
        });

        const requestStart = Date.now();

        connection.on("connect", (err: Error | null) => {
          if (err) {
            connection.close();
            reject(err);
            return;
          }

          const request = new Request(
            sql,
            (err: Error | null, _rowCount: number, resultRows: unknown[]) => {
              connection.close();
              if (err) {
                reject(err);
                return;
              }
              const data = (resultRows as unknown[][]).map((columns: unknown[]) => {
                const row: Record<string, unknown> = {};
                for (const col of columns as { metadata: { colName: string }; value: unknown }[]) {
                  row[col.metadata.colName] = col.value;
                }
                return row;
              });
              resolve(data);
            },
          );

          connection.execSql(request);
        });

        connection.connect();
      });

      const elapsed = Date.now() - attemptStart;
      console.log(`[${viewName}] query_ok attempt=${attemptLabel} rows=${result.length} elapsed_ms=${elapsed} ts=${new Date().toISOString()}`);
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const elapsed = Date.now() - attemptStart;
      console.warn(`[${viewName}] query_fail attempt=${attemptLabel} error="${lastError.message}" elapsed_ms=${elapsed} ts=${new Date().toISOString()}`);

      if (attempt < RETRY_CONFIG.maxRetries) {
        console.log(`[${viewName}] retry_scheduled delay_ms=${RETRY_CONFIG.backoffMs} next_attempt=${attempt + 1} ts=${new Date().toISOString()}`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_CONFIG.backoffMs));
      }
    }
  }

  throw lastError;
}

// =============================================================================
// Sync Logic
// =============================================================================

async function syncView(
  viewName: string,
  supabase: ReturnType<typeof createClient>,
  pageOptions?: { limit: number; offset: number },
): Promise<SyncResult> {
  const config = VIEW_CONFIG[viewName];
  if (!config) {
    return { view: viewName, status: "error", rows: 0, duration_ms: 0, error: `Unknown view: ${viewName}` };
  }

  const startTime = Date.now();
  const startTimestamp = new Date().toISOString();
  console.log(`[${viewName}] sync_start strategy=${config.strategy} ts=${startTimestamp}`);

  // Insert running log entry
  const { data: logEntry } = await supabase
    .schema("mirror")
    .from("sync_log")
    .insert({
      view_name: viewName,
      status: "running",
      strategy_used: config.strategy,
    })
    .select("id")
    .single();

  const logId = logEntry?.id;

  try {
    // 1. Read current watermark for incremental
    const { data: meta } = await supabase
      .schema("mirror")
      .from("sync_metadata")
      .select("last_watermark, strategy")
      .eq("view_name", viewName)
      .single();

    // 2. Build SQL query
    const colList = config.sqlColumns.map((c) => `[${c}]`).join(", ");
    let sql = `SELECT ${colList} FROM [${viewName}]`;

    if (config.strategy === "incremental" && meta?.last_watermark) {
      // Overlap: subtract overlapHours from watermark to recapture recent edits.
      const overlap = config.overlapHours ?? 0;
      const adjustedWatermark = new Date(
        new Date(meta.last_watermark).getTime() - overlap * 3600_000
      ).toISOString();
      sql += ` WHERE [${config.watermarkCol}] >= '${adjustedWatermark}'`;
      sql += ` ORDER BY [${config.watermarkCol}] ASC`;
    }

    // Pagination support — fetch a subset of rows to avoid CPU time limits
    if (pageOptions) {
      sql += sql.includes("ORDER BY") ? "" : " ORDER BY (SELECT NULL)";
      sql += ` OFFSET ${pageOptions.offset} ROWS FETCH NEXT ${pageOptions.limit} ROWS ONLY`;
    }

    // 3. Fetch from SQL Server (with retry + timeout)
    const rows = await execQueryWithRetry(sql, viewName);
    const mapped = rows.map(config.mapRow);

    // 3.5 Deduplicate by conflictKey to avoid "cannot affect row a second time"
    let dedupMapped = mapped;
    if (config.conflictKey) {
      const keys = config.conflictKey.split(",");
      const seen = new Map();
      for (const row of mapped) {
        const key = keys.map((k) => (row as Record<string, unknown>)[k]).join("|");
        seen.set(key, row); // last wins
      }
      dedupMapped = Array.from(seen.values());
    }

    // 4. Write to Supabase
    if (config.strategy === "full") {
      // Only truncate if NOT using pagination (full reload without pages)
      if (!pageOptions) {
        await supabase.rpc("truncate_mirror_table", { table_name: `mirror.${config.table}` });
      }

      // Batch insert (use upsert when conflictKey is defined to handle
      // denormalized views that return duplicate PKs, e.g. crm_negocios)
      for (let i = 0; i < dedupMapped.length; i += BATCH_SIZE) {
        const batch = dedupMapped.slice(i, i + BATCH_SIZE);
        if (config.conflictKey) {
          const { error } = await supabase
            .schema("mirror")
            .from(config.table)
            .upsert(batch, { onConflict: config.conflictKey });
          if (error) {
            throw new Error(`Upsert batch error on ${config.table}: ${error.message}`);
          }
        } else {
          const { error } = await supabase
            .schema("mirror")
            .from(config.table)
            .insert(batch);
          if (error) {
            throw new Error(`Insert batch error on ${config.table}: ${error.message}`);
          }
        }
      }
    } else {
      // Incremental: upsert with conflict key if available, otherwise plain insert
      for (let i = 0; i < dedupMapped.length; i += BATCH_SIZE) {
        const batch = dedupMapped.slice(i, i + BATCH_SIZE);
        if (config.conflictKey) {
          const { error } = await supabase
            .schema("mirror")
            .from(config.table)
            .upsert(batch, { onConflict: config.conflictKey });
          if (error) {
            throw new Error(`Upsert error on ${config.table}: ${error.message}`);
          }
        } else {
          const { error } = await supabase
            .schema("mirror")
            .from(config.table)
            .insert(batch);
          if (error) {
            throw new Error(`Insert error on ${config.table}: ${error.message}`);
          }
        }
      }
    }

    // 5. Compute watermark for incremental views
    let watermarkValue = meta?.last_watermark ?? null;
    if (config.strategy === "incremental" && config.watermarkCol) {
      // Use NOW() as watermark — decoupled from data, avoids gaps from clock skew
      // or out-of-order records. The overlap window on next sync covers any edge cases.
      watermarkValue = new Date().toISOString();
    }

    // 6. Update sync_metadata
    await supabase
      .schema("mirror")
      .from("sync_metadata")
      .update({
        last_watermark: watermarkValue,
        last_sync_at: new Date().toISOString(),
        row_count: dedupMapped.length,
      })
      .eq("view_name", viewName);

    const duration = Date.now() - startTime;
    const endTimestamp = new Date().toISOString();

    // 7. Update sync_log to success
    if (logId) {
      await supabase
        .schema("mirror")
        .from("sync_log")
        .update({
          status: "success",
          rows_affected: dedupMapped.length,
          duration_ms: duration,
          finished_at: endTimestamp,
        })
        .eq("id", logId);
    }

    console.log(`[${viewName}] sync_ok rows=${dedupMapped.length} duration_ms=${duration} start_ts=${startTimestamp} end_ts=${endTimestamp}`);

    return { view: viewName, status: "success", rows: dedupMapped.length, duration_ms: duration };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${viewName}] sync_error error="${errMsg}" duration_ms=${duration} start_ts=${startTimestamp} end_ts=${endTimestamp}`);

    // Update sync_log to error
    if (logId) {
      await supabase
        .schema("mirror")
        .from("sync_log")
        .update({
          status: "error",
          error_message: errMsg,
          duration_ms: duration,
          finished_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    return { view: viewName, status: "error", rows: 0, duration_ms: duration, error: errMsg };
  }
}

// =============================================================================
// HTTP Handler
// =============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const totalStart = Date.now();

  try {
    const supabase = getSupabaseClient();

    // Parse request body
    let viewsToSync: string[] = ALL_VIEWS;
    let pageOptions: { limit: number; offset: number } | undefined;
    try {
      const body = await req.json();
      if (body.views && Array.isArray(body.views) && body.views.length > 0) {
        // Validate requested views
        const invalid = body.views.filter((v: string) => !VIEW_CONFIG[v]);
        if (invalid.length > 0) {
          return new Response(
            JSON.stringify({ error: `Unknown views: ${invalid.join(", ")}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        viewsToSync = body.views;
      }
      // Pagination support — allows fetching in chunks to avoid CPU limits
      if (typeof body.limit === "number" && typeof body.offset === "number") {
        pageOptions = { limit: body.limit, offset: body.offset };
      }
    } catch {
      // Empty body or invalid JSON — sync all views
    }

    // Process views sequentially (single SQL Server connection at a time)
    const results: SyncResult[] = [];
    for (const viewName of viewsToSync) {
      const result = await syncView(viewName, supabase, pageOptions);
      results.push(result);
    }

    const totalDuration = Date.now() - totalStart;

    return new Response(
      JSON.stringify({ results, total_duration_ms: totalDuration }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("sync-campus-dealer fatal error:", errMsg);

    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
