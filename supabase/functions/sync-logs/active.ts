
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
    
    console.log(`Checking active syncs for user ${session.user.id}`);
    
    // Get all active sync processes for this user
    // Explicitly check for records without completed_at date and only specific statuses
    const { data: activeSyncs, error } = await supabase
      .from('sync_logs')
      .select('*')
      .eq('user_id', session.user.id)
      .is('completed_at', null)
      .in('status', ['processing', 'in_progress', 'queued', 'started', 'continues', 'pending'])
      .order('id', { ascending: false });
    
    if (error) {
      console.error('Error fetching active syncs:', error);
      return new Response(
        JSON.stringify({ success: false, message: 'Error fetching active syncs', error: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Return the active sync processes
    return new Response(
      JSON.stringify(activeSyncs || []),
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
