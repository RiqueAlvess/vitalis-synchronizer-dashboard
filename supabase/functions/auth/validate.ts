
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders, syncErrorResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return syncErrorResponse(
        req,
        'Missing authorization header',
        401,
        null,
        'auth/unauthorized'
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
    
    // Create Supabase admin client
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    try {
      // Verify token with admin client
      const { data: { user }, error } = await adminClient.auth.getUser(token);
      
      if (error || !user) {
        return syncErrorResponse(
          req,
          'Invalid authentication token',
          401,
          error?.message || 'User not found',
          'auth/unauthorized'
        );
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            created_at: user.created_at
          }
        }),
        { 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
          status: 200
        }
      );
    } catch (verifyError) {
      console.error('Error verifying token:', verifyError);
      return syncErrorResponse(
        req,
        'Invalid authentication token',
        401,
        'Auth session missing!',
        'auth/unauthorized'
      );
    }
  } catch (error) {
    console.error('Unexpected error in auth validation:', error);
    return syncErrorResponse(
      req,
      'An unexpected error occurred in auth validation',
      500,
      error,
      'auth/server_error'
    );
  }
});
