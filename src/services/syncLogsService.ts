
import { supabase } from "@/integrations/supabase/client";
import { SyncLog, SyncLogStatus, SyncLogType } from "@/types/sync";

// Define the database response type to match what's coming from Supabase
interface DbSyncLog {
  id: number;
  type: string;
  status: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  message?: string;
  error_details?: string;
  user_id?: string;
  parent_id?: number;
  batch?: number;
  total_batches?: number;
  total_records?: number;
  processed_records?: number;
  success_count?: number;
  error_count?: number;
}

export const syncLogsService = {
  // Get all sync logs
  getLogs: async (): Promise<SyncLog[]> => {
    try {
      // Order by id desc to get newest first, then by created_at as backup
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .order('id', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50); // Limitar para evitar carregar muitos registros

      if (error) {
        console.error('Error fetching sync logs:', error);
        throw error;
      }

      // Transform the database response to match SyncLog type
      const transformedData: SyncLog[] = data ? data.map((item: DbSyncLog) => ({
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
      const item = data as DbSyncLog;
      
      const transformedData: SyncLog = {
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
      };

      return transformedData;
    } catch (error) {
      console.error('Error in getLogById service:', error);
      throw error;
    }
  },
  
  // Get logs by parent ID with realtime updates
  getLogsByParentId: async (parentId: number): Promise<SyncLog[]> => {
    try {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('parent_id', parentId)
        .order('batch', { ascending: true });

      if (error) {
        console.error(`Error fetching logs with parent ID ${parentId}:`, error);
        throw error;
      }

      // Transform the database response to match SyncLog type
      const transformedData: SyncLog[] = data ? data.map((item: DbSyncLog) => ({
        id: item.id,
        type: item.type as SyncLogType,
        status: item.status as SyncLogStatus,
        created_at: item.created_at,
        started_at: item.started_at || item.created_at,
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
  
  // Setup realtime subscription for synclog updates
  subscribeToSyncUpdates: async (syncId: number, callback: (log: SyncLog) => void) => {
    try {
      // Subscribe to updates for the main sync log
      const channel = supabase
        .channel(`synclog-${syncId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'sync_logs',
          filter: `id=eq.${syncId}`
        }, (payload) => {
          // Transform payload data to SyncLog
          const updatedLog = payload.new as DbSyncLog;
          const log: SyncLog = {
            id: updatedLog.id,
            type: updatedLog.type as SyncLogType,
            status: updatedLog.status as SyncLogStatus,
            created_at: updatedLog.created_at,
            started_at: updatedLog.started_at || updatedLog.created_at,
            completed_at: updatedLog.completed_at || undefined,
            message: updatedLog.message || undefined,
            error_details: updatedLog.error_details || undefined,
            user_id: updatedLog.user_id || undefined,
            parent_id: updatedLog.parent_id || undefined,
            batch: updatedLog.batch || undefined,
            total_batches: updatedLog.total_batches || undefined,
            total_records: updatedLog.total_records || undefined,
            processed_records: updatedLog.processed_records || undefined,
            success_count: updatedLog.success_count || undefined,
            error_count: updatedLog.error_count || undefined
          };
          
          callback(log);
        })
        .subscribe();
      
      // Return unsubscribe function
      return () => {
        supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error('Error in subscribeToSyncUpdates service:', error);
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
      console.log('Attempting to clear history');
      
      // First fetch active process IDs to avoid deleting them
      const { data: activeProcesses, error: fetchError } = await supabase
        .from('sync_logs')
        .select('id')
        .in('status', ['processing', 'in_progress', 'queued', 'started', 'continues']);
      
      if (fetchError) {
        console.error('Error fetching active processes:', fetchError);
        throw fetchError;
      }
      
      // Only proceed with deletion if we successfully fetched active processes
      const activeIds = activeProcesses?.map(item => item.id) || [];
      console.log('Active process IDs (will be preserved):', activeIds);
      
      // Delete logs that have completed statuses and are not in the active list
      const { error } = await supabase
        .from('sync_logs')
        .delete()
        .in('status', ['completed', 'error', 'cancelled']);
        
      if (error) {
        console.error('Error clearing sync history:', error);
        throw error;
      }
      
      console.log('History cleared successfully');
      return true;
    } catch (error) {
      console.error('Error in clearHistory service:', error);
      throw error;
    }
  },
  
  // Get active sync processes
  getActiveSyncs: async (): Promise<{count: number, types: string[]}> => {
    try {
      console.log('Checking for active sync processes...');
      
      const { data, error } = await supabase
        .from('sync_logs')
        .select('id, type, status')
        .in('status', ['processing', 'in_progress', 'queued', 'started', 'continues']);

      if (error) {
        console.error('Error fetching active syncs:', error);
        throw error;
      }

      // Print debug info
      console.log('Active sync processes data:', data);
      
      // Extract unique types
      const types = [...new Set(data?.map(log => log.type) || [])];
      const count = data?.length || 0;
      
      console.log(`Found ${count} active sync processes of types: ${types.join(', ')}`);
      
      return {
        count,
        types
      };
    } catch (error) {
      console.error('Error in getActiveSyncs service:', error);
      // Don't throw, just return empty result
      return { count: 0, types: [] };
    }
  }
};
