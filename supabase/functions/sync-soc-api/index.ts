
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    // Get the Authorization header
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ success: false, message: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Extract the token from the Authorization header
    const token = authHeader.replace('Bearer ', '');
    
    // Create client with admin role
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
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Invalid token:', authError?.message);
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { type, params } = await req.json();
    console.log('Sync request received:', { type, params });

    // Check if type is valid
    if (!['company', 'employee', 'absenteeism'].includes(type)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid sync type' }),
        { status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Create sync log entry
    const { data: logData, error: logError } = await supabaseAdmin
      .from('sync_logs')
      .insert({
        user_id: user.id,
        type,
        status: 'started',
        message: `Synchronizing ${type} data`
      })
      .select()
      .single();

    if (logError) {
      console.error('Error creating sync log:', logError);
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to create sync log' }),
        { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // In a real implementation, this would call the actual SOC API
    // For now, just return success with the sync log ID
    console.log(`${type} synchronization initiated. Log ID: ${logData.id}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `${type} synchronization has been initiated`,
        jobId: logData.id,
        logId: logData.id
      }),
      { status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message || 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
