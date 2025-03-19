
export interface SyncLog {
  id: number;
  type: 'employee' | 'absenteeism';
  status: 'pending' | 'in_progress' | 'success' | 'error';
  message: string;
  error_details?: string;
  started_at: string;
  completed_at?: string;
  user_id: string;
  created_at: string;
}
