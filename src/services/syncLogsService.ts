
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

      // Convert the raw data to SyncLog type
      const logs: SyncLog[] = data?.map(log => ({
        id: log.id,
        type: log.type,
        status: log.status,
        message: log.message,
        error_details: log.error_details,
        started_at: log.started_at,
        completed_at: log.completed_at,
        user_id: log.user_id,
        created_at: log.created_at
      })) || [];

      return logs;
    } catch (error) {
      console.error('Error in syncLogsService.getLogs:', error);
      return [];
    }
  }
};
