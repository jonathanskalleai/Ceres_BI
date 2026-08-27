export interface TopCliente {
  nome: string;
  cidade: string;
  acoes: number;
  visitas: number;
  negocioValor: number;
  diasSemContato: number;
}

export interface RegiaoVendedor {
  cidade: string;
  acoes: number;
  valor: number;
  clientes: number;
}

export interface EvolucaoMensal {
  YearMonth: string;
  acoes: number;
  visitas: number;
  negocioValor: number;
  clientes?: number;
}

export interface Vendedor {
  nome: string;
  totalAcoes: number;
  visitas: number;
  clientes: number;
  pipeline: number;
  negocios: number;
  /** NULL quando nao ha oportunidade no denominador. */
  conversao: number | null;
  crmQuality: number;
  evolucao: EvolucaoMensal[];
  topClientes: TopCliente[];
  regioes: RegiaoVendedor[];
  tiposAcao: Record<string, number>;
}

export interface RegiaoSummary {
  cidade: string;
  totalAcoes: number;
  clientes: number;
  pipeline: number;
  visitas: number;
  lat?: number;
  lng?: number;
}

export interface Registro {
  numero?: string;        // ACO_CodigoAcao — visible action number
  idAcao?: string;        // ACO_IdAcao — unique identifier (dedup key)
  cliente: string;
  cidade: string;
  vendedor: string;
  tipoContato: string;
  tipoAcao: string;
  negocioValor: number;
  negocioEtapa: string;
  dtConclusao: string;
  obs: string;
  lat?: number;
  lng?: number;
  status?: string;        // ACO_Status (Concluída, Pendente, etc.)
  acaoValida?: string;    // ACO_AcaoValida (Sim/Não)
  dtAbertura?: string;    // ACO_DthAbertura
  uf?: string;            // EMP_UF
  contato?: string;       // ACO_Contato
  nroNegocio?: string;    // NGO_NroNegocio
}

export interface KPIs {
  totalRegistros: number;
  totalClientes: number;
  totalConsultores: number;
  totalPipeline: number;
  totalVisitas: number;
  totalCidades: number;
}

export interface Filters {
  dateRange?: { from: string; to: string }; // ISO date strings (YYYY-MM-DD)
  cidade: string;
  vendedor?: string;
  tipoAcao: string;
  categoria: string;
  funil: string;
}

export interface DadosComerciais {
  kpis: KPIs;
  vendedores: Vendedor[];
  regioes: RegiaoSummary[];
  evolucaoGlobal: EvolucaoMensal[];
  tiposContato: Record<string, number>;
  tiposAcao: Record<string, number>;
  registrosRecentes: Registro[];
  listaVendedores: string[];
  listaCidades: string[];
}
