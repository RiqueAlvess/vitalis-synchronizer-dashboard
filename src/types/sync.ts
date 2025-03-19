
export interface SyncLog {
  id: number;
  type: 'employee' | 'absenteeism' | string;
  status: 'pending' | 'in_progress' | 'success' | 'error' | string;
  message: string;
  error_details?: string;
  started_at: string;
  completed_at?: string;
  user_id: string;
  created_at: string;
}
