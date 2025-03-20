
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    // Get all headers for debugging
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    console.log('Test Connection - Request headers:', JSON.stringify(headers));
    
    // Try to get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Missing authentication header',
          headers
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Get token from header, removing Bearer prefix if present
    const token = authHeader.replace('Bearer ', '');
    
    // For security, mask the token in logs
    const tokenLength = token.length;
    const maskedToken = tokenLength > 10 ? 
      `${token.substring(0, 5)}...${token.substring(tokenLength - 5)}` : 
      'token too short';
    console.log(`Token received (masked): ${maskedToken}, length: ${tokenLength}`);
    
    // Create Supabase client with the token for verification
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });
    
    // Get user data to verify the token
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.error('Error verifying token:', error);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid authentication token',
          error: error.message,
          tokenInfo: {
            length: tokenLength,
            preview: maskedToken
          }
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    if (!user) {
      console.error('No user found for token');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No user associated with token',
          tokenInfo: {
            length: tokenLength,
            preview: maskedToken
          }
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Success response with basic user info
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Connection successful',
        user: {
          id: user.id,
          email: user.email
        },
        timestamp: new Date().toISOString()
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
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : null
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  }
});
