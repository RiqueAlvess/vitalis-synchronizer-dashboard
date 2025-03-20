
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

/**
 * Function to clear completed sync logs while preserving active ones
 * Improved with better validation, security checks, and user feedback
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }
  
  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('Missing authorization header');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Missing authorization header',
          code: 'UNAUTHORIZED'
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Extract token (remove Bearer prefix if it exists)
    const token = authHeader.replace('Bearer ', '');
    
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
    
    // Parse request body (for additional parameters)
    let body = {};
    try {
      if (req.method === 'POST' && req.headers.get('Content-Type')?.includes('application/json')) {
        body = await req.json();
      }
    } catch (e) {
      console.warn('Error parsing request body:', e);
      // Continue with empty body - it's optional
    }
    
    // Get user data to verify the token
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('User verification error:', userError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Invalid authentication token', 
          code: 'TOKEN_EXPIRED'
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log(`User ${user.id} is clearing sync history`);
    
    // First check for active sync processes - don't delete if there are active syncs
    const { data: activeSyncs, error: activeCheckError } = await supabase
      .from('sync_logs')
      .select('id, type, status')
      .eq('user_id', user.id)
      .in('status', ['pending', 'in_progress', 'processing', 'queued', 'started', 'continues', 'needs_continuation'])
      .is('completed_at', null);
    
    if (activeCheckError) {
      console.error('Error checking for active syncs:', activeCheckError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Error checking for active sync processes', 
          error: activeCheckError.message,
          code: 'DB_ERROR'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Block operation if active syncs exist and force parameter is not provided
    if (activeSyncs?.length > 0 && !body.force) {
      const activeTypes = activeSyncs.map(sync => sync.type).join(', ');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Cannot clear history while sync processes are active. You have ${activeSyncs.length} active sync(s): ${activeTypes}`,
          activeSyncs: activeSyncs.map(s => ({ id: s.id, type: s.type, status: s.status })),
          code: 'SYNC_IN_PROGRESS'
        }),
        { 
          status: 409, // Conflict
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Get a count before deletion to report how many records were deleted
    const { count: beforeCount, error: countError } = await supabase
      .from('sync_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['completed', 'error', 'cancelled', 'completed_with_errors'])
      .not('completed_at', 'is', null);
      
    if (countError) {
      console.error('Error counting records to delete:', countError);
      // Continue anyway - this is just for reporting
    }
    
    // Only delete completed, error or cancelled logs with completed_at set
    const query = supabase
      .from('sync_logs')
      .delete()
      .eq('user_id', user.id)
      .in('status', ['completed', 'error', 'cancelled', 'completed_with_errors'])
      .not('completed_at', 'is', null);
    
    // Execute the delete query
    const { data, error } = await query.select('id, status');
    
    if (error) {
      console.error('Error clearing sync history:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Error clearing sync history', 
          error: error.message,
          code: 'DB_DELETE_ERROR'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Check if any records couldn't be cleared
    let uncleared = 0;
    let unclearedTypes: string[] = [];
    
    if (activeSyncs?.length > 0) {
      uncleared = activeSyncs.length;
      unclearedTypes = [...new Set(activeSyncs.map(s => s.type))];
    }
    
    // Create a detailed response with information about what was deleted and what was kept
    const deletedCount = beforeCount || data?.length || 0;
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Cleared ${deletedCount} sync logs${uncleared > 0 ? `, ${uncleared} active logs were preserved` : ''}`, 
        count: deletedCount,
        uncleared,
        unclearedTypes: unclearedTypes.length > 0 ? unclearedTypes : undefined,
        preservedStatuses: uncleared > 0 ? ['pending', 'in_progress', 'processing', 'queued', 'started', 'continues', 'needs_continuation'] : undefined
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Erro interno no servidor', 
        error: error.message,
        code: 'UNKNOWN_ERROR'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  }
});
