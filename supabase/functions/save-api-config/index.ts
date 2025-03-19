
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const configData = await req.json();
    
    if (!configData || !configData.type) {
      return new Response(
        JSON.stringify({ error: 'Invalid request data. Type is required.' }),
        { status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Extract token
    const token = authHeader.replace('Bearer ', '');
    
    // Initialize admin Supabase client
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
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    // Check if user exists
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Add user ID to config data
    const configWithUserId = {
      ...configData,
      user_id: user.id
    };

    // Check if a config with this type already exists for this user
    const { data: existingConfig, error: fetchError } = await supabaseAdmin
      .from('api_credentials')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', configData.type)
      .maybeSingle();
    
    if (fetchError) {
      console.error('Error checking for existing config:', fetchError);
      return new Response(
        JSON.stringify({ error: `Failed to check for existing configuration: ${fetchError.message}` }),
        { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    let result;
    
    // Update or insert based on whether a config already exists
    if (existingConfig) {
      // Update existing config
      const { data, error } = await supabaseAdmin
        .from('api_credentials')
        .update(configWithUserId)
        .eq('id', existingConfig.id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating API config:', error);
        return new Response(
          JSON.stringify({ error: `Failed to update API configuration: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
        );
      }
      
      result = data;
    } else {
      // Insert new config
      const { data, error } = await supabaseAdmin
        .from('api_credentials')
        .insert(configWithUserId)
        .select()
        .single();
      
      if (error) {
        console.error('Error saving API config:', error);
        return new Response(
          JSON.stringify({ error: `Failed to save API configuration: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
        );
      }
      
      result = data;
    }

    // Set isConfigured flag to true
    const resultWithStatus = {
      ...result,
      isConfigured: true
    };

    return new Response(
      JSON.stringify(resultWithStatus),
      { 
        status: 200, 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    
    return new Response(
      JSON.stringify({ error: error.message || 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
