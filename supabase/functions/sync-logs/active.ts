
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

// Cache for active sync requests to reduce database load
const activeSyncsCache = new Map<string, {
  data: any,
  timestamp: number
}>();
const CACHE_TTL = 5000; // 5 seconds TTL for active sync status

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    console.log('Active syncs endpoint called');
    
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: 'Not authenticated' }),
        { 
          status: 401, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Extract token (remove Bearer prefix if it exists)
    const token = authHeader.replace('Bearer ', '');
    
    // Check cache first
    const cacheKey = token;
    const now = Date.now();
    const cachedResult = activeSyncsCache.get(cacheKey);
    
    if (cachedResult && (now - cachedResult.timestamp < CACHE_TTL)) {
      console.log('Returning cached active syncs result');
      return new Response(
        JSON.stringify(cachedResult.data),
        { 
          status: 200, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });
    
    // Verify the token by getting the user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Error verifying user:', userError);
      return new Response(
        JSON.stringify({ success: false, message: 'Authentication failed' }),
        { 
          status: 401, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Set a timeout for the database query
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database query timeout')), 5000);
    });
    
    const queryPromise = supabase
      .from('sync_logs')
      .select('id, type, status, message, batch, total_batches, processed_records, total_records, started_at, updated_at')
      .eq('user_id', user.id)
      .or('status.in.(pending,in_progress,processing,queued,started,continues),status.is.null,and(status.eq.needs_continuation,completed_at.is.null)')
      .order('started_at', { ascending: false });
    
    // Race the query against the timeout
    const { data: activeSyncs, error } = await Promise.race([
      queryPromise,
      timeoutPromise.then(() => {
        throw new Error('Query timeout');
      })
    ]) as any;
    
    if (error) {
      console.error('Error fetching active syncs:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Error fetching active sync processes', 
          error: error.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Also check for hung processes (not updated in a long time)
    const hungLookupPromise = supabase
      .from('sync_logs')
      .select('id, type, status, message, started_at, updated_at')
      .eq('user_id', user.id)
      .is('completed_at', null)
      .not('status', 'in', ['cancelled', 'error', 'completed', 'completed_with_errors'])
      .lt('updated_at', new Date(new Date().getTime() - 10 * 60 * 1000).toISOString()) // Not updated in 10 minutes
      .order('started_at', { ascending: false });
    
    const { data: hungSyncs, error: hungError } = await Promise.race([
      hungLookupPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Hung syncs query timeout')), 5000))
    ]) as any;
    
    // Combine active syncs and hung syncs
    const allActiveSyncs = [...(activeSyncs || [])];
    
    if (!hungError && hungSyncs) {
      // Only add hung syncs that aren't already in the active syncs list
      const activeIds = new Set(allActiveSyncs.map(sync => sync.id));
      for (const hungSync of hungSyncs) {
        if (!activeIds.has(hungSync.id)) {
          hungSync.status = 'hung'; // Mark as hung for the client
          hungSync.message = `${hungSync.message || 'Processo parado'} (possivelmente travado)`;
          allActiveSyncs.push(hungSync);
        }
      }
    }
    
    // Process the result for display
    const types = [...new Set(allActiveSyncs.map(sync => sync.type))];
    
    const result = {
      success: true,
      count: allActiveSyncs.length,
      types,
      logs: allActiveSyncs
    };
    
    // Cache the result
    activeSyncsCache.set(cacheKey, {
      data: result,
      timestamp: now
    });
    
    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Unexpected error in active syncs endpoint:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Internal server error',
        error: error.message
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  }
});
