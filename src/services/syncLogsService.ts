
import supabaseAPI from './apiClient';

export const syncLogsService = {
  // Get all logs with pagination and sorting
  getLogs: async (limit = 50, offset = 0) => {
    try {
      const { data } = await supabaseAPI.get('/sync-logs', {
        params: {
          limit,
          offset,
          order: 'desc' // Most recent first
        }
      });
      
      return data || [];
    } catch (error) {
      console.error('Error fetching sync logs:', error);
      throw error;
    }
  },
  
  // Get a specific log by ID
  getLogById: async (id: number) => {
    try {
      const { data } = await supabaseAPI.get(`/sync-logs`, {
        params: { id }
      });
      
      return data;
    } catch (error) {
      console.error(`Error fetching sync log ${id}:`, error);
      throw error;
    }
  },
  
  // Cancel an active sync
  cancelSync: async (id: number) => {
    try {
      const { data } = await supabaseAPI.post('/sync-logs/cancel', { syncId: id });
      return data;
    } catch (error) {
      console.error(`Error cancelling sync ${id}:`, error);
      throw error;
    }
  },
  
  // Clear sync history (only completed, cancelled or error logs)
  clearHistory: async () => {
    try {
      const { data } = await supabaseAPI.post('/sync-logs/clear');
      return data;
    } catch (error) {
      console.error('Error clearing sync history:', error);
      throw error;
    }
  },
  
  // Get active syncs
  getActiveSyncs: async () => {
    try {
      console.log('Checking for active sync processes...');
      const { data } = await supabaseAPI.get('/sync-logs/active');
      
      if (data && Array.isArray(data)) {
        console.log('Active sync processes data:', data);
        
        // Calculate unique types
        const types = [...new Set(data.map(log => log.type))];
        console.log(`Found ${data.length} active sync processes of types:`, types.join(', '));
        
        return {
          count: data.length,
          types,
          logs: data
        };
      }
      
      return { count: 0, types: [], logs: [] };
    } catch (error) {
      console.error('Error checking active syncs:', error);
      // Return empty result on error
      return { count: 0, types: [], logs: [] };
    }
  },
  
  // Reset all active syncs (emergency function)
  resetActiveSyncs: async () => {
    try {
      const { data } = await supabaseAPI.post('/sync-logs/reset');
      return data;
    } catch (error) {
      console.error('Error resetting active syncs:', error);
      throw error;
    }
  }
};
