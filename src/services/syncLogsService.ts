
import { supabase } from "@/integrations/supabase/client";
import { SyncLog } from "@/types/sync";

export const syncLogsService = {
  // Get all sync logs
  getLogs: async (): Promise<SyncLog[]> => {
    try {
      // Order by id desc to get newest first, then by created_at as backup
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .order('id', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching sync logs:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getLogs service:', error);
      throw error;
    }
  },

  // Get a specific sync log by ID
  getLogById: async (id: number): Promise<SyncLog | null> => {
    try {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error(`Error fetching sync log ID ${id}:`, error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in getLogById service:', error);
      throw error;
    }
  },
  
  // Get logs by parent ID
  getLogsByParentId: async (parentId: number): Promise<SyncLog[]> => {
    try {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('parent_id', parentId)
        .order('id', { ascending: true });

      if (error) {
        console.error(`Error fetching logs with parent ID ${parentId}:`, error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getLogsByParentId service:', error);
      throw error;
    }
  },
  
  // Cancel a sync process
  cancelSync: async (logId: number): Promise<boolean> => {
    try {
      // First update the main log entry
      const { error: updateError } = await supabase
        .from('sync_logs')
        .update({
          status: 'cancelled',
          message: 'Processo cancelado pelo usuário',
          completed_at: new Date().toISOString()
        })
        .eq('id', logId);

      if (updateError) {
        console.error(`Error cancelling sync log ${logId}:`, updateError);
        throw updateError;
      }
      
      // Then check and update any child processes
      const { data: childLogs, error: fetchError } = await supabase
        .from('sync_logs')
        .select('id')
        .eq('parent_id', logId);
        
      if (fetchError) {
        console.error(`Error fetching child logs for ${logId}:`, fetchError);
      } else if (childLogs && childLogs.length > 0) {
        // Update all child processes to cancelled as well
        const { error: updateChildrenError } = await supabase
          .from('sync_logs')
          .update({
            status: 'cancelled',
            message: 'Processo cancelado pelo usuário',
            completed_at: new Date().toISOString()
          })
          .eq('parent_id', logId);
          
        if (updateChildrenError) {
          console.error(`Error cancelling child logs for ${logId}:`, updateChildrenError);
        }
      }

      return true;
    } catch (error) {
      console.error('Error in cancelSync service:', error);
      throw error;
    }
  },
  
  // Clear completed/error sync history logs
  clearHistory: async (): Promise<boolean> => {
    try {
      // Delete only logs that are completed, with error, or cancelled
      // Do not delete logs that are in progress
      const { error } = await supabase
        .from('sync_logs')
        .delete()
        .in('status', ['completed', 'error', 'cancelled']);

      if (error) {
        console.error('Error clearing sync history:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error in clearHistory service:', error);
      throw error;
    }
  },
  
  // Get active sync processes
  getActiveSyncs: async (): Promise<{count: number, types: string[]}> => {
    try {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('id, type')
        .in('status', ['processing', 'in_progress', 'queued', 'started', 'continues']);

      if (error) {
        console.error('Error fetching active syncs:', error);
        throw error;
      }

      // Extract unique types
      const types = [...new Set(data?.map(log => log.type) || [])];
      
      return {
        count: data?.length || 0,
        types
      };
    } catch (error) {
      console.error('Error in getActiveSyncs service:', error);
      return { count: 0, types: [] };
    }
  }
};
