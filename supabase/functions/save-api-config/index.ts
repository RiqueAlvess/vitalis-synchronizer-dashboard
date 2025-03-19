
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Get the session
    const { data: { session } } = await supabase.auth.getSession();

    // Check if user is authenticated
    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse the request body
    const config = await req.json();
    console.log('Received config to save:', config);

    // Validate config object
    if (!config || !config.type) {
      return new Response(
        JSON.stringify({ error: 'Invalid config: missing type field' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const validTypes = ['company', 'employee', 'absenteeism'];
    if (!validTypes.includes(config.type)) {
      return new Response(
        JSON.stringify({ error: `Invalid config type: ${config.type}` }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check for existing config
    const { data: existingConfig, error: fetchError } = await supabase
      .from('api_configs')
      .select('id')
      .eq('type', config.type)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error checking for existing config:', fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Prepare the config data with user_id
    const configData = {
      ...config,
      user_id: session.user.id,
      updated_at: new Date().toISOString()
    };

    let result;

    // Update or insert config
    if (existingConfig) {
      console.log(`Updating existing ${config.type} config with ID ${existingConfig.id}`);
      const { data, error } = await supabase
        .from('api_configs')
        .update(configData)
        .eq('id', existingConfig.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating config:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      result = data;
    } else {
      console.log(`Creating new ${config.type} config`);
      const { data, error } = await supabase
        .from('api_configs')
        .insert({
          ...configData,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error inserting config:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      result = data;
    }

    console.log('Config saved successfully:', result);

    // Return the saved config
    return new Response(
      JSON.stringify({
        ...result,
        isConfigured: !!result.empresa && !!result.codigo && !!result.chave
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An unexpected error occurred' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
