
// src/services/syncLogsService.ts
import supabaseAPI from './apiClient';

// Helper for more robust API calls with proper error handling
const safeApiCall = async (apiCall, fallback = null, logPrefix = 'API') => {
  try {
    const result = await apiCall();
    return result?.data || fallback;
  } catch (error) {
    // Log error but don't crash
    console.error(`${logPrefix} Error:`, error);
    return fallback;
  }
};

export const syncLogsService = {
  // Get all sync logs with pagination and better error handling
  getLogs: async (limit = 50, offset = 0, order = 'desc') => {
    try {
      // Add cache busting parameter to prevent stale responses
      const timestamp = new Date().getTime();
      const { data } = await supabaseAPI.get(`/sync-logs?limit=${limit}&offset=${offset}&order=${order}&_t=${timestamp}`, {
        timeout: 15000, // Shorter timeout for log fetching
      });
      console.log('Fetched sync logs:', data?.data);
      return data?.data || [];
    } catch (error) {
      console.error('Error fetching sync logs:', error);
      // Return empty array as fallback instead of throwing
      return [];
    }
  },
  
  // Get a specific sync log by ID with better error handling
  getLog: async (id: number) => {
    return safeApiCall(
      () => supabaseAPI.get(`/sync-logs?id=${id}`),
      null,
      `Sync log ${id}`
    ).then(data => data?.[0] || null);
  },
  
  // Get active sync processes - Optimized with error handling and caching
  getActiveSyncs: async () => {
    try {
      console.log('Checking active sync processes...');
      
      // Add cache busting to prevent stale responses
      const timestamp = new Date().getTime();
      const { data } = await supabaseAPI.get(`/sync-logs/active?_t=${timestamp}`, {
        timeout: 15000, // Shorter timeout for active checks
      });
      
      // Log response for debugging
      console.log('Active syncs response:', data);
      
      // Validate response structure and return
      if (data && typeof data === 'object') {
        return {
          count: data.count || 0, 
          types: data.types || [], 
          logs: data.logs || []
        };
      } else {
        console.warn('Invalid response format from active syncs endpoint:', data);
        return { count: 0, types: [], logs: [] };
      }
    } catch (error) {
      console.error('Error checking active syncs:', error);
      // Manual check as fallback if API fails
      console.log('Manual check for active syncs:', { count: 0, types: [], logs: [] });
      // Return empty result on error to prevent UI issues
      return { count: 0, types: [], logs: [] };
    }
  },
  
  // Reset all active sync processes with forced timeout
  resetActiveSyncs: async () => {
    try {
      const { data } = await supabaseAPI.post('/sync-logs/reset', {}, {
        timeout: 10000 // Enforce a shorter timeout for reset operation
      });
      
      console.log('Reset active syncs result:', data);
      
      // Force refresh after reset
      setTimeout(() => {
        syncLogsService.getLogs();
      }, 1000);
      
      return data || { success: true, message: 'Syncs reset request processed' };
    } catch (error) {
      console.error('Error resetting active syncs:', error);
      return { success: false, message: 'Failed to reset syncs: ' + (error.message || 'Unknown error') };
    }
  },
  
  // Cancel a specific sync process with confirmation of success
  cancelSync: async (syncId: number) => {
    try {
      console.log(`Attempting to cancel sync #${syncId}...`);
      
      const { data } = await supabaseAPI.post('/sync-logs/cancel', { 
        syncId,
        force: true // Add force parameter to ensure cancellation works
      }, {
        timeout: 20000 // Increased timeout to ensure cancellation completes
      });
      
      console.log(`Cancel sync #${syncId} result:`, data);
      
      // Verify the cancel was successful by checking the sync status
      setTimeout(async () => {
        try {
          const updatedLog = await syncLogsService.getLog(syncId);
          console.log(`Sync #${syncId} status after cancel:`, updatedLog?.status);
          
          // If still not cancelled, attempt one more time with force parameter
          if (updatedLog && ['processing', 'in_progress', 'queued', 'started', 'continues'].includes(updatedLog.status)) {
            console.log(`Sync #${syncId} not cancelled properly, attempting force cancel...`);
            await supabaseAPI.post('/sync-logs/cancel', { 
              syncId,
              force: true,
              forceTerminate: true
            });
          }
        } catch (err) {
          console.error(`Error verifying cancel status for sync #${syncId}:`, err);
        }
      }, 2000);
      
      return data || { success: true, message: 'Cancelamento iniciado com sucesso.' };
    } catch (error) {
      console.error(`Error cancelling sync #${syncId}:`, error);
      return { 
        success: false, 
        message: `Falha ao cancelar sincronização #${syncId}: ${error.message || 'Erro desconhecido'}` 
      };
    }
  },
  
  // Clear sync history with forced parameters
  clearHistory: async () => {
    try {
      console.log('Attempting to clear sync history...');
      
      const { data } = await supabaseAPI.post('/sync-logs/clear', {
        force: true, // Add force parameter
        keepActive: true // Only clear completed/error/cancelled items
      }, {
        timeout: 10000 // Enforce a shorter timeout
      });
      
      console.log('Clear history result:', data);
      
      // Force refresh logs after clearing
      setTimeout(() => {
        syncLogsService.getLogs();
      }, 1000);
      
      return data || { success: true, message: 'Histórico de sincronização limpo com sucesso' };
    } catch (error) {
      console.error('Error clearing sync history:', error);
      return { 
        success: false, 
        message: 'Falha ao limpar histórico: ' + (error.message || 'Erro desconhecido') 
      };
    }
  },
  
  // Force retry a failed or stuck sync
  retrySync: async (syncId: number) => {
    return safeApiCall(
      () => supabaseAPI.post('/sync-logs/retry', { syncId }),
      { success: false, message: 'Falha ao reiniciar sincronização' },
      `Retry sync ${syncId}`
    );
  },
  
  // Set up a timeout to automatically cancel hung syncs
 setupSyncWatchdog: async () => {
  try {
    const activeSyncs = await syncLogsService.getActiveSyncs();
    
    // Check each active sync to see if it's hung (no updates for over 10 minutes)
    if (activeSyncs.logs && activeSyncs.logs.length > 0) {
      const now = new Date();
      
      for (const sync of activeSyncs.logs) {
        // Parse dates
        const startedAt = new Date(sync.started_at);
        const updatedAt = sync.updated_at ? new Date(sync.updated_at) : startedAt;
        
        // Calculate elapsed time in minutes
        const elapsedMinutes = (now.getTime() - updatedAt.getTime()) / (1000 * 60);
        
        // If no update for more than 10 minutes, consider it hung
        if (elapsedMinutes > 10) {
          console.log(`Detected hung sync #${sync.id}, elapsed minutes: ${elapsedMinutes.toFixed(1)}`);
          
          // Attempt to cancel it
          await syncLogsService.cancelSync(sync.id);
          
          // Update the sync record to mark it as hung/timed out
          await supabaseAPI.post('/sync-logs/update-status', {
            syncId: sync.id,
            status: 'error',
            message: `Sincronização cancelada automaticamente após ${elapsedMinutes.toFixed(0)} minutos sem atualizações.`,
            errorDetails: 'Possível sincronização travada detectada pelo sistema e cancelada automaticamente.'
          });
          
          // After a short delay, try to restart the sync
          setTimeout(async () => {
            // Create a new sync log entry for continuation
            try {
              const { data } = await supabaseAPI.post('/sync-logs/retry', { 
                syncId: sync.id,
                force: true  // Force retry even on error status
              });
              console.log(`Auto-restarted hung sync #${sync.id}, new sync ID: ${data?.newSyncId || 'unknown'}`);
            } catch (retryError) {
              console.error(`Failed to auto-restart hung sync #${sync.id}:`, retryError);
            }
          }, 5000);
        }
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error in sync watchdog:', error);
    return { success: false, error };
  }
}
};
