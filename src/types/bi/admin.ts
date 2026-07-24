// Types for rpc_admin_bi (server-side aggregation)

export interface AdminBIKpis {
  totalClientes: number;
  prospects: number;
  ativos: number;
  ufsCobertas: number;
  consultoresCarteira: number;
  empresas: number;
}

export interface AdminBINameValue {
  name: string;
  value: number;
}

/** Full return type of rpc_admin_bi */
export interface RpcAdminBI {
  kpis: AdminBIKpis;
  prospectVsAtivo: AdminBINameValue[];
  porTipoCliente: AdminBINameValue[];
  porUF: AdminBINameValue[];
  porConsultor: AdminBINameValue[];
}
