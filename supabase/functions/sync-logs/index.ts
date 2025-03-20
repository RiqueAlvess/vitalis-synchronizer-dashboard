
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
    
    // Parse URL and get query parameters
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const order = url.searchParams.get('order') || 'desc';
    
    // If ID is provided, get a specific log
    if (id) {
      console.log(`Fetching sync log with ID ${id}`);
      
      const { data: log, error } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('id', id)
        .eq('user_id', session.user.id)
        .single();
      
      if (error) {
        console.error(`Error fetching sync log ${id}:`, error);
        return new Response(
          JSON.stringify({ success: false, message: `Error fetching sync log ${id}`, error: error.message }),
          { 
            status: 500, 
            headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
          }
        );
      }
      
      return new Response(
        JSON.stringify(log),
        { 
          status: 200, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    } else {
      console.log(`Fetching sync logs with limit ${limit}, offset ${offset}, order ${order}`);
      
      // Get all logs for this user with pagination
      const { data: logs, error } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('user_id', session.user.id)
        .order('id', { ascending: order === 'asc' })
        .limit(limit)
        .range(offset, offset + limit - 1);
      
      if (error) {
        console.error('Error fetching sync logs:', error);
        return new Response(
          JSON.stringify({ success: false, message: 'Error fetching sync logs', error: error.message }),
          { 
            status: 500, 
            headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
          }
        );
      }
      
      return new Response(
        JSON.stringify(logs),
        { 
          status: 200, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
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
