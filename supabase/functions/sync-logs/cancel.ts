
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
    
    // Parse request body
    const body = await req.json();
    const syncId = body.syncId;
    
    if (!syncId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing required parameter: syncId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log(`Cancelling sync process ${syncId} for user ${session.user.id}`);
    
    // Check if the sync log exists and belongs to the user
    const { data: syncLog, error: fetchError } = await supabase
      .from('sync_logs')
      .select('id, status, type')
      .eq('id', syncId)
      .eq('user_id', session.user.id)
      .single();
    
    if (fetchError) {
      console.error(`Error fetching sync log ${syncId}:`, fetchError);
      return new Response(
        JSON.stringify({ success: false, message: `Error fetching sync log ${syncId}`, error: fetchError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    if (!syncLog) {
      return new Response(
        JSON.stringify({ success: false, message: `Sync log ${syncId} not found or does not belong to you` }),
        { 
          status: 404, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Update the sync log to cancelled status
    const { error: updateError } = await supabase
      .from('sync_logs')
      .update({
        status: 'cancelled',
        message: 'Processo cancelado pelo usuário',
        completed_at: new Date().toISOString()
      })
      .eq('id', syncId)
      .eq('user_id', session.user.id);
    
    if (updateError) {
      console.error(`Error updating sync log ${syncId}:`, updateError);
      return new Response(
        JSON.stringify({ success: false, message: `Error updating sync log ${syncId}`, error: updateError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sync process ${syncId} cancelled successfully`,
        syncId,
        type: syncLog.type
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
