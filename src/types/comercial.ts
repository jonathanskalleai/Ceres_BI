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
  conversao: number;
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
  vendedor: string;
  cidade: string;
  periodo: string;
  ano: string;
  mes: string;
  tipoAcao: string;
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
