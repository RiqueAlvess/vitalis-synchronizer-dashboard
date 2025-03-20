import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    // Debug request headers
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    console.log('Sync-Logs Reset - Request headers:', JSON.stringify(headers));
    
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Missing authorization header',
          headers
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Extract token (remove Bearer prefix if it exists)
    const token = authHeader.replace('Bearer ', '');
    
    // Create admin client to verify the token
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // Get user with service role to verify the token
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Error verifying token:', userError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Not authenticated',
          error: userError ? userError.message : 'No user found for token'
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log(`Authenticated as user: ${user.email} (${user.id})`);
    
    // Initialize with service role for admin operations
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // Check for continuable syncs before cancelling anything
    const { data: continuableSyncs } = await supabaseAdmin
      .from('sync_logs')
      .select('id, type, status, batch, processed_records, total_records')
      .eq('user_id', user.id)
      .in('status', ['needs_continuation', 'continues'])
      .is('completed_at', null)
      .order('started_at', { ascending: false });
    
    // Update all active sync processes to 'cancelled'
    const { data: updatedSyncs, error: updateError } = await supabaseAdmin
      .from('sync_logs')
      .update({
        status: 'cancelled',
        message: 'Sincronização cancelada manualmente',
        completed_at: new Date().toISOString(),
        error_details: 'Reset solicitado pelo usuário'
      })
      .or('status.eq.pending,status.eq.in_progress,status.eq.processing,status.eq.queued,status.eq.started')
      .is('completed_at', null)
      .select();
    
    if (updateError) {
      console.error('Error resetting active syncs:', updateError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Error resetting active syncs',
          error: updateError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Don't cancel syncs that need continuation, just include them in the response
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'All active sync processes have been reset',
        count: updatedSyncs?.length || 0,
        continuableSyncs: continuableSyncs || []
      }),
      { 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Unexpected error', 
        error: error instanceof Error ? error.message : String(error) 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  }
});
