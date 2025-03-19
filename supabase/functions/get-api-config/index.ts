
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the request URL
    const url = new URL(req.url);
    const configType = url.pathname.split('/').pop() || '';

    console.log(`Fetching API config for type: ${configType}`);

    // Valid config types
    const validTypes = ['company', 'employee', 'absenteeism'];
    if (!validTypes.includes(configType)) {
      return new Response(
        JSON.stringify({ error: `Invalid config type: ${configType}` }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Get user session
    const { data: { session } } = await supabase.auth.getSession();

    // Require authentication
    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get config from database
    const { data, error } = await supabase
      .from('api_configs')
      .select('*')
      .eq('type', configType)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching API config:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // If no config found, return null but still 200 status
    if (!data) {
      console.log(`No ${configType} config found for user ${session.user.id}`);
      return new Response(
        JSON.stringify(null),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log the config found
    console.log(`Found ${configType} config:`, data);

    // Return the config
    return new Response(
      JSON.stringify({ 
        ...data,
        // Ensure these are proper strings
        type: data.type || configType,
        tipoSaida: data.tipoSaida || 'json',
        isConfigured: !!data.empresa && !!data.codigo && !!data.chave
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
