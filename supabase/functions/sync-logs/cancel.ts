
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Extract token
    const token = authHeader.replace('Bearer ', '');
    
    // Initialize admin Supabase client
    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    // Verify the token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    // Check if user exists
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse the request body to get the syncId
    const { syncId } = await req.json();
    
    if (!syncId || isNaN(Number(syncId))) {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing syncId parameter' }),
        { status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }
    
    // Get the sync log to verify it belongs to the user
    const { data: syncLog, error: syncLogError } = await supabaseAdmin
      .from('sync_logs')
      .select('*')
      .eq('id', syncId)
      .single();
      
    if (syncLogError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch sync log', details: syncLogError.message }),
        { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }
    
    // Verify the log belongs to the user making the request
    if (syncLog.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'You are not authorized to cancel this sync process' }),
        { status: 403, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }
    
    // Update the main sync log to cancelled
    const { error: updateError } = await supabaseAdmin
      .from('sync_logs')
      .update({
        status: 'cancelled',
        message: 'Processo cancelado pelo usuário',
        completed_at: new Date().toISOString()
      })
      .eq('id', syncId);
      
    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to cancel sync process', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }
    
    // Find and update any child processes
    const { data: childLogs, error: fetchError } = await supabaseAdmin
      .from('sync_logs')
      .select('id')
      .eq('parent_id', syncId);
      
    if (!fetchError && childLogs && childLogs.length > 0) {
      // Update all child processes to cancelled as well
      const { error: updateChildrenError } = await supabaseAdmin
        .from('sync_logs')
        .update({
          status: 'cancelled',
          message: 'Processo cancelado pelo usuário',
          completed_at: new Date().toISOString()
        })
        .eq('parent_id', syncId);
        
      if (updateChildrenError) {
        console.error(`Error cancelling child logs for ${syncId}:`, updateChildrenError);
        // Continue anyway since the main process was cancelled
      }
    }
    
    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Sync process cancelled successfully' 
      }),
      { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Unexpected error in cancel sync endpoint:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unexpected error occurred while cancelling the sync process' 
      }),
      { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
