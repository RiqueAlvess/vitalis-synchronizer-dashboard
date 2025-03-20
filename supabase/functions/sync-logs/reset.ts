
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
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Get the session to verify authentication
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return new Response(
        JSON.stringify({ success: false, message: 'Not authenticated' }),
        { 
          status: 401, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log(`User ${session.user.id} is resetting all active sync processes`);
    
    // Find all in-progress sync processes for this user
    const { data: activeSyncs, error: findError } = await supabase
      .from('sync_logs')
      .select('id, type, status')
      .eq('user_id', session.user.id)
      .in('status', ['processing', 'in_progress', 'queued', 'started', 'continues', 'pending'])
      .order('id', { ascending: false });
    
    if (findError) {
      console.error('Error finding active syncs:', findError);
      return new Response(
        JSON.stringify({ success: false, message: 'Error finding active syncs', error: findError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    if (!activeSyncs || activeSyncs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active syncs found', count: 0 }),
        { 
          status: 200, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log(`Found ${activeSyncs.length} active syncs to reset`);
    
    // Update all in-progress syncs to cancelled
    const { error: updateError } = await supabase
      .from('sync_logs')
      .update({
        status: 'cancelled',
        message: 'Processo cancelado manualmente por reset de sistema',
        completed_at: new Date().toISOString()
      })
      .in('id', activeSyncs.map(sync => sync.id));
    
    if (updateError) {
      console.error('Error updating sync logs:', updateError);
      return new Response(
        JSON.stringify({ success: false, message: 'Error updating sync logs', error: updateError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Reset ${activeSyncs.length} active sync processes`, 
        count: activeSyncs.length,
        syncs: activeSyncs
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
