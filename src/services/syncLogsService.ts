
import { supabase } from "@/integrations/supabase/client";
import { SyncLog, SyncLogStatus, SyncLogType } from "@/types/sync";

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

      // Transform the database response to match SyncLog type
      const transformedData: SyncLog[] = data ? data.map(item => ({
        id: item.id,
        type: item.type as SyncLogType,
        status: item.status as SyncLogStatus,
        created_at: item.created_at,
        started_at: item.started_at || item.created_at, // Use created_at as fallback if started_at is missing
        completed_at: item.completed_at || undefined,
        message: item.message || undefined,
        error_details: item.error_details || undefined,
        user_id: item.user_id || undefined,
        parent_id: item.parent_id || undefined,
        batch: item.batch || undefined,
        total_batches: item.total_batches || undefined,
        total_records: item.total_records || undefined,
        processed_records: item.processed_records || undefined,
        success_count: item.success_count || undefined,
        error_count: item.error_count || undefined
      })) : [];

      return transformedData;
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

      if (!data) return null;

      // Transform the data to match SyncLog type
      const transformedData: SyncLog = {
        id: data.id,
        type: data.type as SyncLogType,
        status: data.status as SyncLogStatus,
        created_at: data.created_at,
        started_at: data.started_at || data.created_at, // Use created_at as fallback if started_at is missing
        completed_at: data.completed_at || undefined,
        message: data.message || undefined,
        error_details: data.error_details || undefined,
        user_id: data.user_id || undefined,
        parent_id: data.parent_id || undefined,
        batch: data.batch || undefined,
        total_batches: data.total_batches || undefined,
        total_records: data.total_records || undefined,
        processed_records: data.processed_records || undefined,
        success_count: data.success_count || undefined,
        error_count: data.error_count || undefined
      };

      return transformedData;
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

      // Transform the database response to match SyncLog type
      const transformedData: SyncLog[] = data ? data.map(item => ({
        id: item.id,
        type: item.type as SyncLogType,
        status: item.status as SyncLogStatus,
        created_at: item.created_at,
        started_at: item.started_at || item.created_at, // Use created_at as fallback if started_at is missing
        completed_at: item.completed_at || undefined,
        message: item.message || undefined,
        error_details: item.error_details || undefined,
        user_id: item.user_id || undefined,
        parent_id: item.parent_id || undefined,
        batch: item.batch || undefined,
        total_batches: item.total_batches || undefined,
        total_records: item.total_records || undefined,
        processed_records: item.processed_records || undefined,
        success_count: item.success_count || undefined,
        error_count: item.error_count || undefined
      })) : [];

      return transformedData;
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
