
export type SyncLogType = 'employee' | 'absenteeism' | string;
export type SyncLogStatus = 'pending' | 'in_progress' | 'success' | 'error' | string;

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
}
