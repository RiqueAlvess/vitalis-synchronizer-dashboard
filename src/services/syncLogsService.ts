
import { supabaseAPI } from "@/services/apiClient";

export interface SyncLog {
  id: number;
  type: string;
  status: string;
  message: string;
  created_at: string;
  completed_at: string | null;
}

export const syncLogsService = {
  getLogs: async (): Promise<SyncLog[]> => {
    try {
      const response = await supabaseAPI.get<SyncLog[]>('/api/sync/logs');
      return response.data;
    } catch (error) {
      console.error('Error fetching sync logs:', error);
      // Return empty array as fallback
      return [];
    }
  }
};
