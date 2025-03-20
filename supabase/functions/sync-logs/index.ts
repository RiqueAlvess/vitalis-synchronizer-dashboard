
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
    
    console.log('Sync-Logs - Request headers:', JSON.stringify(headers));
    
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
    
    // Log token details (first and last few characters, for security)
    const tokenLength = token.length;
    const maskedToken = tokenLength > 10 ? 
      `${token.substring(0, 5)}...${token.substring(tokenLength - 5)}` : 
      'token too short';
    console.log(`Token received (masked): ${maskedToken}, length: ${tokenLength}`);
    
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
    
    // Initialize regular Supabase client for data operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });
    
    // Parse URL parameters
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const order = url.searchParams.get('order') || 'desc';
    const id = url.searchParams.get('id');
    
    // Get sync logs
    let query = supabase
      .from('sync_logs')
      .select('*')
      .order('created_at', { ascending: order !== 'desc' });
    
    // Apply filters if ID is provided
    if (id) {
      query = query.eq('id', id);
    }
    
    // Apply pagination
    query = query.range(offset, offset + limit - 1);
    
    const { data: logs, error: logsError } = await query;
    
    if (logsError) {
      console.error('Error fetching sync logs:', logsError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Error fetching sync logs',
          error: logsError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        data: logs
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
