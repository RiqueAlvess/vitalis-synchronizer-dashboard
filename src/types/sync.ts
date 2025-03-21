
export type SyncLogType = 'employee' | 'absenteeism' | string;
export type SyncLogStatus = 'pending' | 'in_progress' | 'completed' | 'error' | 'continues' | 'queued' | 'started' | 'processing' | 'cancelled' | string;

export interface SyncLog {
  id: number;
  type: SyncLogType;
  status: SyncLogStatus;
  created_at: string;
  started_at: string;
  completed_at?: string;
  message?: string;
  error_details?: string;
  user_id?: string;
  parent_id?: number;      // ID do registro pai para continuar lotes
  batch?: number;          // Número do lote atual
  total_batches?: number;  // Número total de lotes
  total_records?: number;  // Total de registros a serem processados
  processed_records?: number; // Registros já processados
  success_count?: number;  // Contagem de sucessos
  error_count?: number;    // Contagem de erros
}
