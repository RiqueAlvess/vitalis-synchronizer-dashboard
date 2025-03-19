export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      absenteeism: {
        Row: {
          birth_date: string | null
          certificate_type: number | null
          company_id: number | null
          created_at: string
          days_absent: number | null
          employee_id: number | null
          employee_registration: string | null
          end_date: string
          end_time: string | null
          gender: number | null
          hours_absent: string | null
          icd_description: string | null
          id: number
          license_type: string | null
          pathological_group: string | null
          primary_icd: string | null
          sector: string | null
          start_date: string
          start_time: string | null
          unit: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          birth_date?: string | null
          certificate_type?: number | null
          company_id?: number | null
          created_at?: string
          days_absent?: number | null
          employee_id?: number | null
          employee_registration?: string | null
          end_date: string
          end_time?: string | null
          gender?: number | null
          hours_absent?: string | null
          icd_description?: string | null
          id?: number
          license_type?: string | null
          pathological_group?: string | null
          primary_icd?: string | null
          sector?: string | null
          start_date: string
          start_time?: string | null
          unit?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          birth_date?: string | null
          certificate_type?: number | null
          company_id?: number | null
          created_at?: string
          days_absent?: number | null
          employee_id?: number | null
          employee_registration?: string | null
          end_date?: string
          end_time?: string | null
          gender?: number | null
          hours_absent?: string | null
          icd_description?: string | null
          id?: number
          license_type?: string | null
          pathological_group?: string | null
          primary_icd?: string | null
          sector?: string | null
          start_date?: string
          start_time?: string | null
          unit?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "absenteeism_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absenteeism_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      api_configs: {
        Row: {
          afastado: string | null
          ativo: string | null
          chave: string
          codigo: string
          created_at: string
          datafim: string | null
          datainicio: string | null
          empresa: string
          empresatrabalho: string | null
          ferias: string | null
          id: number
          inativo: string | null
          pendente: string | null
          tiposaida: string | null
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          afastado?: string | null
          ativo?: string | null
          chave: string
          codigo: string
          created_at?: string
          datafim?: string | null
          datainicio?: string | null
          empresa: string
          empresatrabalho?: string | null
          ferias?: string | null
          id?: number
          inativo?: string | null
          pendente?: string | null
          tiposaida?: string | null
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          afastado?: string | null
          ativo?: string | null
          chave?: string
          codigo?: string
          created_at?: string
          datafim?: string | null
          datainicio?: string | null
          empresa?: string
          empresatrabalho?: string | null
          ferias?: string | null
          id?: number
          inativo?: string | null
          pendente?: string | null
          tiposaida?: string | null
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      api_credentials: {
        Row: {
          afastado: string | null
          ativo: string | null
          chave: string
          codigo: string
          created_at: string
          datafim: string | null
          datainicio: string | null
          empresa: string
          empresatrabalho: string | null
          ferias: string | null
          id: string
          inativo: string | null
          pendente: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          afastado?: string | null
          ativo?: string | null
          chave: string
          codigo: string
          created_at?: string
          datafim?: string | null
          datainicio?: string | null
          empresa: string
          empresatrabalho?: string | null
          ferias?: string | null
          id?: string
          inativo?: string | null
          pendente?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          afastado?: string | null
          ativo?: string | null
          chave?: string
          codigo?: string
          created_at?: string
          datafim?: string | null
          datainicio?: string | null
          empresa?: string
          empresatrabalho?: string | null
          ferias?: string | null
          id?: string
          inativo?: string | null
          pendente?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          address_complement: string | null
          address_number: string | null
          city: string | null
          client_code: string | null
          corporate_name: string | null
          created_at: string
          id: number
          initial_corporate_name: string | null
          integration_client_code: string | null
          is_active: boolean | null
          municipal_registration: string | null
          neighborhood: string | null
          short_name: string
          soc_code: string
          state: string | null
          state_registration: string | null
          tax_id: string | null
          updated_at: string
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          city?: string | null
          client_code?: string | null
          corporate_name?: string | null
          created_at?: string
          id?: number
          initial_corporate_name?: string | null
          integration_client_code?: string | null
          is_active?: boolean | null
          municipal_registration?: string | null
          neighborhood?: string | null
          short_name: string
          soc_code: string
          state?: string | null
          state_registration?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          city?: string | null
          client_code?: string | null
          corporate_name?: string | null
          created_at?: string
          id?: number
          initial_corporate_name?: string | null
          integration_client_code?: string | null
          is_active?: boolean | null
          municipal_registration?: string | null
          neighborhood?: string | null
          short_name?: string
          soc_code?: string
          state?: string | null
          state_registration?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      employees: {
        Row: {
          address: string | null
          address_number: string | null
          birth_date: string | null
          birthplace: string | null
          city: string | null
          commercial_phone: string | null
          company_id: number | null
          company_name: string | null
          company_soc_code: string
          contract_type: number | null
          cost_center: string | null
          cost_center_name: string | null
          cpf: string | null
          created_at: string
          disability_description: string | null
          education: number | null
          email: string | null
          employee_registration: string | null
          extension: string | null
          full_name: string
          gender: number | null
          hire_date: string | null
          home_phone: string | null
          hr_cost_center_unit: string | null
          hr_position: string | null
          hr_registration: string | null
          hr_sector: string | null
          hr_unit: string | null
          id: number
          is_disabled: boolean | null
          last_update_date: string | null
          marital_status: number | null
          mobile_phone: string | null
          mother_name: string | null
          neighborhood: string | null
          pis: string | null
          position_cbo: string | null
          position_code: string | null
          position_name: string | null
          rg: string | null
          rg_issuer: string | null
          rg_state: string | null
          sector_code: string | null
          sector_name: string | null
          shift_regime: number | null
          skin_color: number | null
          soc_code: string
          state: string | null
          status: string | null
          termination_date: string | null
          unit_code: string | null
          unit_name: string | null
          updated_at: string
          user_id: string | null
          work_card: string | null
          work_card_series: string | null
          work_regime: string | null
          work_shift: number | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_number?: string | null
          birth_date?: string | null
          birthplace?: string | null
          city?: string | null
          commercial_phone?: string | null
          company_id?: number | null
          company_name?: string | null
          company_soc_code: string
          contract_type?: number | null
          cost_center?: string | null
          cost_center_name?: string | null
          cpf?: string | null
          created_at?: string
          disability_description?: string | null
          education?: number | null
          email?: string | null
          employee_registration?: string | null
          extension?: string | null
          full_name: string
          gender?: number | null
          hire_date?: string | null
          home_phone?: string | null
          hr_cost_center_unit?: string | null
          hr_position?: string | null
          hr_registration?: string | null
          hr_sector?: string | null
          hr_unit?: string | null
          id?: number
          is_disabled?: boolean | null
          last_update_date?: string | null
          marital_status?: number | null
          mobile_phone?: string | null
          mother_name?: string | null
          neighborhood?: string | null
          pis?: string | null
          position_cbo?: string | null
          position_code?: string | null
          position_name?: string | null
          rg?: string | null
          rg_issuer?: string | null
          rg_state?: string | null
          sector_code?: string | null
          sector_name?: string | null
          shift_regime?: number | null
          skin_color?: number | null
          soc_code: string
          state?: string | null
          status?: string | null
          termination_date?: string | null
          unit_code?: string | null
          unit_name?: string | null
          updated_at?: string
          user_id?: string | null
          work_card?: string | null
          work_card_series?: string | null
          work_regime?: string | null
          work_shift?: number | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_number?: string | null
          birth_date?: string | null
          birthplace?: string | null
          city?: string | null
          commercial_phone?: string | null
          company_id?: number | null
          company_name?: string | null
          company_soc_code?: string
          contract_type?: number | null
          cost_center?: string | null
          cost_center_name?: string | null
          cpf?: string | null
          created_at?: string
          disability_description?: string | null
          education?: number | null
          email?: string | null
          employee_registration?: string | null
          extension?: string | null
          full_name?: string
          gender?: number | null
          hire_date?: string | null
          home_phone?: string | null
          hr_cost_center_unit?: string | null
          hr_position?: string | null
          hr_registration?: string | null
          hr_sector?: string | null
          hr_unit?: string | null
          id?: number
          is_disabled?: boolean | null
          last_update_date?: string | null
          marital_status?: number | null
          mobile_phone?: string | null
          mother_name?: string | null
          neighborhood?: string | null
          pis?: string | null
          position_cbo?: string | null
          position_code?: string | null
          position_name?: string | null
          rg?: string | null
          rg_issuer?: string | null
          rg_state?: string | null
          sector_code?: string | null
          sector_name?: string | null
          shift_regime?: number | null
          skin_color?: number | null
          soc_code?: string
          state?: string | null
          status?: string | null
          termination_date?: string | null
          unit_code?: string | null
          unit_name?: string | null
          updated_at?: string
          user_id?: string | null
          work_card?: string | null
          work_card_series?: string | null
          work_regime?: string | null
          work_shift?: number | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_name: string
          created_at: string
          full_name: string
          id: string
          is_premium: boolean | null
          job_title: string | null
          updated_at: string
        }
        Insert: {
          company_name: string
          created_at?: string
          full_name: string
          id: string
          is_premium?: boolean | null
          job_title?: string | null
          updated_at?: string
        }
        Update: {
          company_name?: string
          created_at?: string
          full_name?: string
          id?: string
          is_premium?: boolean | null
          job_title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_details: string | null
          id: number
          message: string | null
          started_at: string
          status: string
          type: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_details?: string | null
          id?: number
          message?: string | null
          started_at?: string
          status: string
          type: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_details?: string | null
          id?: number
          message?: string | null
          started_at?: string
          status?: string
          type?: string
          user_id?: string | null
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

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
