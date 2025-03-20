
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

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
        JSON.stringify({ success: false, message: 'Missing authorization header' }),
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
        JSON.stringify({ success: false, message: 'Invalid authentication token' }),
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
      .in('status', ['pending', 'in_progress', 'processing', 'queued', 'started', 'continues'])
      .is('completed_at', null);
    
    if (activeCheckError) {
      console.error('Error checking for active syncs:', activeCheckError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Error checking for active sync processes', 
          error: activeCheckError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    if (activeSyncs?.length > 0 && !body.force) {
      const activeTypes = activeSyncs.map(sync => sync.type).join(', ');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Cannot clear history while sync processes are active. You have ${activeSyncs.length} active sync(s): ${activeTypes}`,
          activeSyncs: activeSyncs.map(s => ({ id: s.id, type: s.type, status: s.status }))
        }),
        { 
          status: 409, // Conflict
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
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
        JSON.stringify({ success: false, message: 'Error clearing sync history', error: error.message }),
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
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Cleared ${data?.length || 0} sync logs${uncleared > 0 ? `, ${uncleared} active logs were preserved` : ''}`, 
        count: data?.length || 0,
        uncleared,
        unclearedTypes: unclearedTypes.length > 0 ? unclearedTypes : undefined
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Erro interno no servidor', error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  }
});
