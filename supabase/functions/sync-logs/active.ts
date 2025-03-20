
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/cors.ts';

// Get environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

export const corsOptions = {
  headers: {
    ...corsHeaders(),
    'Content-Type': 'application/json',
  },
};

export async function activeHandler(req: Request): Promise<Response> {
  console.log('Active syncs endpoint called');
    
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }
  
  try {
    // Initialize the Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Authenticate the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }
    
    // Extract the token
    const token = authHeader.replace('Bearer ', '');
    
    // Verify the token and get the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ success: false, message: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Authenticated as user:', user.email, `(${user.id})`);
    
    // Fetch active sync logs - including statuses that may need attention
    const { data: logs, error } = await supabase
      .from('sync_logs')
      .select('*')
      .or('status.eq.in_progress,status.eq.queued,status.eq.started,status.eq.continues,status.eq.processing')
      .order('started_at', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error('Error fetching active syncs:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Error fetching active syncs', 
          error: error.message 
        }),
        { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }
    
    // Extract unique types from active syncs
    const types = [...new Set(logs.map(log => log.type))];
    
    // Return the results
    return new Response(
      JSON.stringify({ 
        success: true, 
        count: logs.length,
        types,
        logs
      }),
      { status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Unexpected error in active syncs:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'An unexpected error occurred', 
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
}
