
import { SyncLog } from '@/types/sync';
import { supabase } from '@/integrations/supabase/client';

export const syncLogsService = {
  getLogs: async (): Promise<SyncLog[]> => {
    try {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching sync logs:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in syncLogsService.getLogs:', error);
      return [];
    }
  }
};
