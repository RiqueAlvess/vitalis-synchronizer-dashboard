
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Extract token
    const token = authHeader.replace('Bearer ', '');

    // Create admin Supabase client
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify the token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    const url = new URL(req.url);
    const path = url.pathname.split('/');
    const logId = path[path.length - 1];

    // Check if requesting a specific log
    if (logId && logId !== 'sync-logs') {
      console.log(`Fetching sync log with ID: ${logId}`);
      
      // Get a specific sync log
      const { data: log, error: logError } = await supabaseAdmin
        .from('sync_logs')
        .select('*')
        .eq('id', logId)
        .eq('user_id', user.id)
        .single();
      
      if (logError) {
        console.error('Error fetching sync log:', logError);
        return new Response(
          JSON.stringify({ success: false, message: 'Failed to fetch sync log' }),
          { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
        );
      }
      
      if (!log) {
        return new Response(
          JSON.stringify({ success: false, message: 'Sync log not found' }),
          { status: 404, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify(log),
        { status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    } else {
      // Get all sync logs for the user
      console.log('Fetching all sync logs for user:', user.id);
      
      const { data: logs, error: logsError } = await supabaseAdmin
        .from('sync_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(50);

      if (logsError) {
        console.error('Error fetching sync logs:', logsError);
        return new Response(
          JSON.stringify({ success: false, message: 'Failed to fetch sync logs' }),
          { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(logs || []),
        { status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
