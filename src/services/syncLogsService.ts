
import supabaseAPI from './apiClient';

export const syncLogsService = {
  // Get all sync logs with pagination
  getLogs: async (limit = 50, offset = 0, order = 'desc') => {
    try {
      const { data } = await supabaseAPI.get(`/sync-logs?limit=${limit}&offset=${offset}&order=${order}`);
      return data?.data || [];
    } catch (error) {
      console.error('Error fetching sync logs:', error);
      throw error;
    }
  },
  
  // Get a specific sync log by ID
  getLog: async (id: number) => {
    try {
      const { data } = await supabaseAPI.get(`/sync-logs?id=${id}`);
      return data?.data?.[0] || null;
    } catch (error) {
      console.error(`Error fetching sync log ${id}:`, error);
      throw error;
    }
  },
  
  // Get active sync processes - Improved with error handling and fallback
  getActiveSyncs: async () => {
    try {
      console.log('Checking active sync processes...');
      // Use the retryRequest helper for more reliable fetching
      const { data } = await supabaseAPI.get('/sync-logs/active', {
        timeout: 10000, // Shorter timeout for active syncs check
      });
      
      // Log response for debugging
      console.log('Active syncs:', data);
      
      // Validate response structure and return
      if (data && typeof data === 'object') {
        return data.logs ? 
          { count: data.count || 0, types: data.types || [], logs: data.logs || [] } : 
          { count: 0, types: [], logs: [] };
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
    try {
      const { data } = await supabaseAPI.post('/sync-logs/reset');
      return data;
    } catch (error) {
      console.error('Error resetting active syncs:', error);
      throw error;
    }
  },
  
  // Cancel a specific sync process
  cancelSync: async (syncId: number) => {
    try {
      const { data } = await supabaseAPI.post('/sync-logs/cancel', { syncId });
      return data;
    } catch (error) {
      console.error(`Error cancelling sync ${syncId}:`, error);
      throw error;
    }
  },
  
  // Clear sync history
  clearHistory: async () => {
    try {
      const { data } = await supabaseAPI.post('/sync-logs/clear');
      return data;
    } catch (error) {
      console.error('Error clearing sync history:', error);
      throw error;
    }
  },
  
  // Force retry a failed or stuck sync
  retrySync: async (syncId: number) => {
    try {
      const { data } = await supabaseAPI.post('/sync-logs/retry', { syncId });
      return data;
    } catch (error) {
      console.error(`Error retrying sync ${syncId}:`, error);
      throw error;
    }
  }
};
