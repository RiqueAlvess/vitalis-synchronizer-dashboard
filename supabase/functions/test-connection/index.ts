
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
    // Get all headers for detailed debugging
    const allHeaders = {};
    req.headers.forEach((value, key) => {
      allHeaders[key] = value;
    });
    
    console.log('Request headers:', JSON.stringify(allHeaders));

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('Missing authorization header');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Missing authorization header',
          headers: allHeaders 
        }),
        { status: 401, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
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
    
    // Try both methods of authentication for diagnostics
    
    // 1. First, try with explicitly passed token
    console.log('Attempting authentication with explicit token...');
    let userData = null;
    
    try {
      // Initialize Supabase client with the explicit token
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
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (user) {
        console.log('Authentication successful with explicit token');
        userData = user;
      } else {
        console.log('Authentication failed with explicit token:', userError?.message);
      }
    } catch (tokenError) {
      console.error('Error using explicit token:', tokenError);
    }
    
    // 2. If first method failed, try with admin client
    if (!userData) {
      console.log('Attempting authentication with admin client...');
      try {
        const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });
        
        const { data: { user }, error: adminError } = await adminClient.auth.getUser(token);
        
        if (user) {
          console.log('Authentication successful with admin client');
          userData = user;
        } else {
          console.log('Authentication failed with admin client:', adminError?.message);
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: 'Invalid authentication token',
              error: adminError?.message || 'No user found with admin verification',
              tokenInfo: {
                length: tokenLength,
                preview: maskedToken
              }
            }),
            { status: 401, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
          );
        }
      } catch (adminError) {
        console.error('Error using admin client:', adminError);
      }
    }
    
    // If we still don't have user data, authentication failed
    if (!userData) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Authentication failed with all methods',
          tokenInfo: {
            length: tokenLength,
            preview: maskedToken
          }
        }),
        { status: 401, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    console.log('Connection test successful for user:', userData.id);

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Connection successful',
        userId: userData.id,
        email: userData.email
      }),
      { status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message || 'An unexpected error occurred',
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
