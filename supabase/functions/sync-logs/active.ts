
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders, handleCorsPreflightRequest, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';

// Get environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

export async function activeHandler(req: Request): Promise<Response> {
  console.log('Active syncs endpoint called');
    
  // Handle CORS preflight requests
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;
  
  try {
    // Initialize the Supabase client with timeout configuration
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        fetch: (url, options = {}) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
          options.signal = controller.signal;
          return fetch(url, options).finally(() => clearTimeout(timeoutId));
        }
      }
    });
    
    // Authenticate the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return createErrorResponse('Missing authorization header', 401, null, req);
    }
    
    // Extract the token
    const token = authHeader.replace('Bearer ', '');
    
    // Verify the token and get the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return createErrorResponse('Authentication failed', 401, authError, req);
    }
    
    console.log('Authenticated as user:', user.email, `(${user.id})`);
    
    // Use more specific query with proper indexing for better performance
    // Only select necessary columns to reduce payload size
    const { data: logs, error } = await supabase
      .from('sync_logs')
      .select('id, type, status, message, started_at, updated_at, completed_at')
      .or('status.eq.in_progress,status.eq.queued,status.eq.started,status.eq.continues,status.eq.processing')
      .order('started_at', { ascending: false })
      .limit(20); // Reduced limit for faster response
    
    if (error) {
      console.error('Error fetching active syncs:', error);
      return createErrorResponse('Error fetching active syncs', 500, error, req);
    }
    
    // Extract unique types from active syncs
    const types = [...new Set(logs.map(log => log.type))];
    
    // Return the results with a more efficient payload
    return createSuccessResponse({ 
      count: logs.length,
      types,
      logs
    }, 'Active syncs retrieved successfully', req);
    
  } catch (error) {
    console.error('Unexpected error in active syncs:', error);
    return createErrorResponse('An unexpected error occurred', 500, error, req);
  }
}
