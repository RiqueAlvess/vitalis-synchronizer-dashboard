
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/cors.ts';

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
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Missing authorization header'
        }),
        { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' }, status: 401 }
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
    
    // Create diagnostic results
    const diagnostics = {
      standardAuth: { tried: false, success: false, error: null, user: null },
      explicitAuth: { tried: false, success: false, error: null, user: null },
      adminAuth: { tried: false, success: false, error: null, user: null },
    };
    
    // 1. Admin auth - verifying token with service role
    try {
      diagnostics.adminAuth.tried = true;
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      
      const { data: { user }, error } = await adminClient.auth.getUser(token);
      
      if (error) {
        diagnostics.adminAuth.error = error.message;
      } else if (user) {
        diagnostics.adminAuth.success = true;
        diagnostics.adminAuth.user = { id: user.id, email: user.email };
      }
    } catch (error) {
      diagnostics.adminAuth.error = error instanceof Error ? error.message : String(error);
    }
    
    // Determine overall success
    const anySuccess = diagnostics.adminAuth.success;
    const user = diagnostics.adminAuth.user;
    
    return new Response(
      JSON.stringify({
        success: anySuccess,
        user: user,
        diagnostics: diagnostics,
        tokenInfo: {
          length: tokenLength,
          preview: maskedToken
        }
      }),
      { 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        status: anySuccess ? 200 : 401
      }
    );
  } catch (error) {
    console.error('Unexpected error in auth validation:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : 'An unexpected error occurred in auth validation',
        stack: error instanceof Error ? error.stack : null
      }),
      { 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
