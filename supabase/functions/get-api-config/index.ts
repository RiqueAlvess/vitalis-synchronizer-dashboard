
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
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
        JSON.stringify({ 
          error: `Invalid config type: ${configType}`,
          type: configType,
          empresa: '',
          codigo: '',
          chave: '',
          tipoSaida: 'json',
          isConfigured: false
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase clients - regular for auth, admin for data operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ 
          error: 'Missing authorization header',
          type: configType,
          empresa: '',
          codigo: '',
          chave: '',
          tipoSaida: 'json',
          isConfigured: false
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    console.log('Verifying token:', token.substring(0, 10) + '...');
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    // Check if authentication is valid
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ 
          error: 'Not authenticated',
          details: authError?.message,
          type: configType,
          empresa: '',
          codigo: '',
          chave: '',
          tipoSaida: 'json',
          isConfigured: false
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Looking for ${configType} config for user ${user.id}`);

    // Try to get from api_credentials table first using admin client
    const { data: credentials, error: credentialsError } = await adminSupabase
      .from('api_credentials')
      .select('*')
      .eq('type', configType)
      .eq('user_id', user.id)
      .maybeSingle();
      
    if (credentialsError) {
      console.error('Error fetching from api_credentials:', credentialsError);
    } else if (credentials) {
      console.log(`Found ${configType} config in api_credentials table:`, credentials);
      
      // Convert from database format to API format
      const response: any = {
        type: credentials.type,
        empresa: credentials.empresa,
        codigo: credentials.codigo,
        chave: credentials.chave,
        tipoSaida: 'json',
        isConfigured: true
      };
      
      // Add type-specific fields
      if (configType === 'employee') {
        response.ativo = credentials.ativo || 'Sim';
        response.inativo = credentials.inativo || '';
        response.afastado = credentials.afastado || '';
        response.pendente = credentials.pendente || '';
        response.ferias = credentials.ferias || '';
      } else if (configType === 'absenteeism') {
        response.empresaTrabalho = credentials.empresatrabalho || '';
        response.dataInicio = credentials.datainicio || '';
        response.dataFim = credentials.datafim || '';
      }
      
      return new Response(
        JSON.stringify(response),
        { 
          status: 200, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }

    // If not found in api_credentials, try the legacy api_configs table
    const { data, error } = await adminSupabase
      .from('api_configs')
      .select('*')
      .eq('type', configType)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching API config:', error);
      return new Response(
        JSON.stringify({ 
          error: error.message,
          type: configType,
          empresa: '',
          codigo: '',
          chave: '',
          tipoSaida: 'json',
          isConfigured: false
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }

    // If no config found, return empty object with default values but still 200 status
    if (!data) {
      console.log(`No ${configType} config found for user ${user.id}`);
      return new Response(
        JSON.stringify({
          type: configType,
          empresa: '',
          codigo: '',
          chave: '',
          tipoSaida: 'json',
          isConfigured: false
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log the config found
    console.log(`Found ${configType} config in legacy table for user ${user.id}`);

    // Return the config with proper defaults to ensure all fields exist
    return new Response(
      JSON.stringify({ 
        ...data,
        // Ensure these are proper strings
        type: data.type || configType,
        empresa: data.empresa || '',
        codigo: data.codigo || '',
        chave: data.chave || '',
        tipoSaida: data.tipoSaida || 'json',
        isConfigured: !!data.empresa && !!data.codigo && !!data.chave
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unexpected error occurred',
        type: 'unknown',
        empresa: '',
        codigo: '',
        chave: '',
        tipoSaida: 'json',
        isConfigured: false
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  }
});
