
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    const url = new URL(req.url);
    const configType = url.pathname.split('/').pop();

    if (!configType) {
      return new Response(
        JSON.stringify({ error: 'Missing API config type' }),
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

    // Get user's API configuration from the database
    const { data: configData, error: configError } = await supabaseAdmin
      .from('api_credentials')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', configType)
      .single();

    if (configError && configError.code !== 'PGRST116') {
      console.error(`Error fetching ${configType} API config:`, configError);
      
      return new Response(
        JSON.stringify({ error: `Failed to fetch API configuration: ${configError.message}` }),
        { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Return empty default config if none exists
    if (!configData) {
      let defaultConfig = {
        type: configType,
        empresa: '',
        codigo: '',
        chave: '',
        tipoSaida: 'json',
        isConfigured: false
      };

      // Add specific fields based on type
      if (configType === 'employee') {
        defaultConfig = {
          ...defaultConfig,
          ativo: 'Sim',
          inativo: '',
          afastado: '',
          pendente: '',
          ferias: ''
        };
      } else if (configType === 'absenteeism') {
        defaultConfig = {
          ...defaultConfig,
          empresaTrabalho: '',
          dataInicio: '',
          dataFim: ''
        };
      }

      return new Response(
        JSON.stringify(defaultConfig),
        { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Set isConfigured flag to true if config exists
    const configWithStatus = {
      ...configData,
      isConfigured: true
    };

    return new Response(
      JSON.stringify(configWithStatus),
      { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    
    return new Response(
      JSON.stringify({ error: error.message || 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
