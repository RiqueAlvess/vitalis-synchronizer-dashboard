
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
  
  // Get active sync processes
  getActiveSyncs: async () => {
    try {
      console.log('Checking active sync processes...');
      const { data } = await supabaseAPI.get('/sync-logs/active');
      console.log('Manual check for active syncs:', data);
      return data || { count: 0, types: [], logs: [] };
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
  }
};
