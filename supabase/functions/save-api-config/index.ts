
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get the session using the token
    const token = authHeader.replace('Bearer ', '');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    // Check if session exists
    if (sessionError || !session) {
      console.error('Session error:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { 
          status: 401, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
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
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }

    const validTypes = ['company', 'employee', 'absenteeism'];
    if (!validTypes.includes(config.type)) {
      return new Response(
        JSON.stringify({ error: `Invalid config type: ${config.type}` }),
        { 
          status: 400, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }

    // Prepare data for api_credentials table
    let credentialsData: any = {
      type: config.type,
      empresa: config.empresa,
      codigo: config.codigo,
      chave: config.chave,
      user_id: session.user.id
    };
    
    // Add type-specific fields
    if (config.type === 'employee') {
      credentialsData.ativo = config.ativo || 'Sim';
      credentialsData.inativo = config.inativo || '';
      credentialsData.afastado = config.afastado || '';
      credentialsData.pendente = config.pendente || '';
      credentialsData.ferias = config.ferias || '';
    } else if (config.type === 'absenteeism') {
      credentialsData.empresatrabalho = config.empresaTrabalho || '';
      credentialsData.datainicio = config.dataInicio || '';
      credentialsData.datafim = config.dataFim || '';
    }

    // Check for existing record in api_credentials
    const { data: existingCredentials, error: fetchCredentialsError } = await supabase
      .from('api_credentials')
      .select('id')
      .eq('type', config.type)
      .eq('user_id', session.user.id)
      .maybeSingle();
      
    if (fetchCredentialsError) {
      console.error('Error checking for existing credentials:', fetchCredentialsError);
    }
    
    // Save to api_credentials table
    let credentials;
    if (existingCredentials) {
      // Update existing record
      const { data, error } = await supabase
        .from('api_credentials')
        .update(credentialsData)
        .eq('id', existingCredentials.id)
        .select('*')
        .single();
        
      if (error) {
        console.error('Error updating credentials:', error);
      } else {
        credentials = data;
        console.log('Updated credentials successfully:', credentials);
      }
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('api_credentials')
        .insert(credentialsData)
        .select('*')
        .single();
        
      if (error) {
        console.error('Error inserting credentials:', error);
      } else {
        credentials = data;
        console.log('Inserted credentials successfully:', credentials);
      }
    }
    
    // For backward compatibility, also check for existing config in api_configs table
    const { data: existingConfig, error: fetchError } = await supabase
      .from('api_configs')
      .select('id')
      .eq('type', config.type)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error checking for existing config:', fetchError);
    }

    // Prepare the config data with user_id for api_configs
    const configData = {
      ...config,
      user_id: session.user.id,
      updated_at: new Date().toISOString()
    };

    // Save to api_configs (legacy table)
    let legacyResult;
    if (existingConfig) {
      console.log(`Updating existing ${config.type} config with ID ${existingConfig.id}`);
      const { data, error } = await supabase
        .from('api_configs')
        .update(configData)
        .eq('id', existingConfig.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating legacy config:', error);
      } else {
        legacyResult = data;
      }
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
        console.error('Error inserting legacy config:', error);
      } else {
        legacyResult = data;
      }
    }

    // Prepare the response (prioritize credentials if available)
    const result = credentials || legacyResult;
    
    // If neither save worked, return an error
    if (!result) {
      return new Response(
        JSON.stringify({ error: 'Failed to save API configuration' }),
        { 
          status: 500, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Config saved successfully:', result);

    // Convert api_credentials format to the expected API response format
    let apiResponse: any = {
      type: result.type,
      empresa: result.empresa,
      codigo: result.codigo,
      chave: result.chave,
      tipoSaida: 'json',
      isConfigured: true
    };
    
    // Add type-specific fields if needed
    if (config.type === 'employee') {
      apiResponse.ativo = result.ativo || 'Sim';
      apiResponse.inativo = result.inativo || '';
      apiResponse.afastado = result.afastado || '';
      apiResponse.pendente = result.pendente || '';
      apiResponse.ferias = result.ferias || '';
    } else if (config.type === 'absenteeism') {
      // Map from database naming to API naming
      apiResponse.empresaTrabalho = result.empresatrabalho || '';
      apiResponse.dataInicio = result.datainicio || '';
      apiResponse.dataFim = result.datafim || '';
    }

    // Return the saved config with CORS headers
    return new Response(
      JSON.stringify(apiResponse),
      { 
        status: 200, 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    // Ensure CORS headers are applied to error responses as well
    return new Response(
      JSON.stringify({ error: error.message || 'An unexpected error occurred' }),
      { 
        status: 500, 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  }
});
