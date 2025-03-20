
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
      console.log('Active syncs:', data);
      
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
      // Return empty result on error to prevent UI issues
      return { count: 0, types: [], logs: [] };
    }
  },
  
  // Reset all active sync processes
  resetActiveSyncs: async () => {
    return safeApiCall(
      () => supabaseAPI.post('/sync-logs/reset'),
      { success: false, message: 'Failed to reset syncs' },
      'Reset syncs'
    );
  },
  
  // Cancel a specific sync process
  cancelSync: async (syncId: number) => {
    return safeApiCall(
      () => supabaseAPI.post('/sync-logs/cancel', { syncId }),
      { success: false, message: 'Failed to cancel sync' },
      `Cancel sync ${syncId}`
    );
  },
  
  // Clear sync history
  clearHistory: async () => {
    return safeApiCall(
      () => supabaseAPI.post('/sync-logs/clear'),
      { success: false, message: 'Failed to clear history' },
      'Clear history'
    );
  },
  
  // Force retry a failed or stuck sync
  retrySync: async (syncId: number) => {
    return safeApiCall(
      () => supabaseAPI.post('/sync-logs/retry', { syncId }),
      { success: false, message: 'Failed to retry sync' },
      `Retry sync ${syncId}`
    );
  }
};
