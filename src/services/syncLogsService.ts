
import { supabase } from "@/integrations/supabase/client";
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
      // Fetch sync logs directly from the database
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
        
      if (error) {
        console.error('Error fetching sync logs from database:', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('Error fetching sync logs:', error);
      // Try API endpoint as fallback
      try {
        const response = await supabaseAPI.get<SyncLog[]>('/api/sync/logs');
        return response.data;
      } catch (apiError) {
        console.error('Error fetching sync logs from API:', apiError);
        return [];
      }
    }
  }
};
