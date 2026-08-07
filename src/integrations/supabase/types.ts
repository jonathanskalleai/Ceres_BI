export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      negocios_mensais: {
        Row: {
          cli_cnpj_cpf: string | null
          cli_tipo_cliente: string | null
          cliente: string | null
          cod_consultor: string | null
          consultor: string | null
          created_at: string
          emp_nome: string | null
          etiqueta: string | null
          id: string
          ngo_atualizacao: string | null
          ngo_conclusao: string | null
          ngo_dth_abertura: string | null
          ngo_etapa: string | null
          ngo_funil: string | null
          ngo_motivo_ganho: string | null
          ngo_numero: string | null
          pdo_aprovador: string | null
          pdo_cidade_entrega: string | null
          pdo_cidade_uf_faturamento: string | null
          pdo_dth_abertura: string | null
          pdo_dth_aprovacao: string | null
          pdo_dth_registro: string | null
          pdo_financiamento_banco: string | null
          pdo_frete: string | null
          pdo_motivo_cancelamento: string | null
          pdo_nro_pedido: string | null
          pdo_obs_pedido: string | null
          pdo_situacao_pedido: string | null
          pdo_status: string | null
          pdo_vlr_financiado: number | null
          pdo_vlr_recurso_proprio: number | null
          recebido: number | null
          relacao: string | null
          tipo: string | null
          unidade: string | null
          usado: number | null
          valor_pedido: number | null
        }
        Insert: {
          cli_cnpj_cpf?: string | null
          cli_tipo_cliente?: string | null
          cliente?: string | null
          cod_consultor?: string | null
          consultor?: string | null
          created_at?: string
          emp_nome?: string | null
          etiqueta?: string | null
          id?: string
          ngo_atualizacao?: string | null
          ngo_conclusao?: string | null
          ngo_dth_abertura?: string | null
          ngo_etapa?: string | null
          ngo_funil?: string | null
          ngo_motivo_ganho?: string | null
          ngo_numero?: string | null
          pdo_aprovador?: string | null
          pdo_cidade_entrega?: string | null
          pdo_cidade_uf_faturamento?: string | null
          pdo_dth_abertura?: string | null
          pdo_dth_aprovacao?: string | null
          pdo_dth_registro?: string | null
          pdo_financiamento_banco?: string | null
          pdo_frete?: string | null
          pdo_motivo_cancelamento?: string | null
          pdo_nro_pedido?: string | null
          pdo_obs_pedido?: string | null
          pdo_situacao_pedido?: string | null
          pdo_status?: string | null
          pdo_vlr_financiado?: number | null
          pdo_vlr_recurso_proprio?: number | null
          recebido?: number | null
          relacao?: string | null
          tipo?: string | null
          unidade?: string | null
          usado?: number | null
          valor_pedido?: number | null
        }
        Update: {
          cli_cnpj_cpf?: string | null
          cli_tipo_cliente?: string | null
          cliente?: string | null
          cod_consultor?: string | null
          consultor?: string | null
          created_at?: string
          emp_nome?: string | null
          etiqueta?: string | null
          id?: string
          ngo_atualizacao?: string | null
          ngo_conclusao?: string | null
          ngo_dth_abertura?: string | null
          ngo_etapa?: string | null
          ngo_funil?: string | null
          ngo_motivo_ganho?: string | null
          ngo_numero?: string | null
          pdo_aprovador?: string | null
          pdo_cidade_entrega?: string | null
          pdo_cidade_uf_faturamento?: string | null
          pdo_dth_abertura?: string | null
          pdo_dth_aprovacao?: string | null
          pdo_dth_registro?: string | null
          pdo_financiamento_banco?: string | null
          pdo_frete?: string | null
          pdo_motivo_cancelamento?: string | null
          pdo_nro_pedido?: string | null
          pdo_obs_pedido?: string | null
          pdo_situacao_pedido?: string | null
          pdo_status?: string | null
          pdo_vlr_financiado?: number | null
          pdo_vlr_recurso_proprio?: number | null
          recebido?: number | null
          relacao?: string | null
          tipo?: string | null
          unidade?: string | null
          usado?: number | null
          valor_pedido?: number | null
        }
        Relationships: []
      }
      registros_comerciais: {
        Row: {
          bairro: string | null
          cidade_cliente: string | null
          cidade_empresa: string | null
          cliente_cnpj: string | null
          cliente_codigo: string | null
          cliente_nome: string | null
          cod_vendedor: string | null
          contato: string | null
          created_at: string
          dt_agendamento_fim: string | null
          dt_agendamento_ini: string | null
          dt_conclusao: string | null
          dt_registro: string | null
          empresa: string | null
          empresa_cnpj: string | null
          etiqueta: string | null
          id: string
          latitude: number | null
          longitude: number | null
          negocio_etapa: string | null
          negocio_funil: string | null
          negocio_valor: number | null
          nro_acao: string | null
          nro_negocio: string | null
          obs_final: string | null
          obs_inicial: string | null
          relacao: string | null
          status: string | null
          tipo_acao: string | null
          tipo_contato: string | null
          vendedor: string | null
        }
        Insert: {
          bairro?: string | null
          cidade_cliente?: string | null
          cidade_empresa?: string | null
          cliente_cnpj?: string | null
          cliente_codigo?: string | null
          cliente_nome?: string | null
          cod_vendedor?: string | null
          contato?: string | null
          created_at?: string
          dt_agendamento_fim?: string | null
          dt_agendamento_ini?: string | null
          dt_conclusao?: string | null
          dt_registro?: string | null
          empresa?: string | null
          empresa_cnpj?: string | null
          etiqueta?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          negocio_etapa?: string | null
          negocio_funil?: string | null
          negocio_valor?: number | null
          nro_acao?: string | null
          nro_negocio?: string | null
          obs_final?: string | null
          obs_inicial?: string | null
          relacao?: string | null
          status?: string | null
          tipo_acao?: string | null
          tipo_contato?: string | null
          vendedor?: string | null
        }
        Update: {
          bairro?: string | null
          cidade_cliente?: string | null
          cidade_empresa?: string | null
          cliente_cnpj?: string | null
          cliente_codigo?: string | null
          cliente_nome?: string | null
          cod_vendedor?: string | null
          contato?: string | null
          created_at?: string
          dt_agendamento_fim?: string | null
          dt_agendamento_ini?: string | null
          dt_conclusao?: string | null
          dt_registro?: string | null
          empresa?: string | null
          empresa_cnpj?: string | null
          etiqueta?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          negocio_etapa?: string | null
          negocio_funil?: string | null
          negocio_valor?: number | null
          nro_acao?: string | null
          nro_negocio?: string | null
          obs_final?: string | null
          obs_inicial?: string | null
          relacao?: string | null
          status?: string | null
          tipo_acao?: string | null
          tipo_contato?: string | null
          vendedor?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
