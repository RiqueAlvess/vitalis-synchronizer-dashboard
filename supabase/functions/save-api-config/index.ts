
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
    console.log('Received save-api-config request');
    
    // Initialize Supabase client with service role for admin operations
    const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Initialize regular client for auth checks
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
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
    console.log('Verifying token:', token.substring(0, 10) + '...');
    
    // Verify token with JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    // Check if user exists
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Not authenticated', details: authError?.message }),
        { 
          status: 401, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('User authenticated:', user.id);

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
      user_id: user.id
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

    console.log('Credentials data prepared:', credentialsData);

    // Check for existing record in api_credentials using admin client for reliability
    const { data: existingCredentials, error: fetchCredentialsError } = await adminSupabase
      .from('api_credentials')
      .select('id')
      .eq('type', config.type)
      .eq('user_id', user.id)
      .maybeSingle();
      
    if (fetchCredentialsError) {
      console.error('Error checking for existing credentials:', fetchCredentialsError);
    }
    
    // Save to api_credentials table using admin client to bypass RLS
    let credentials;
    if (existingCredentials) {
      console.log('Updating existing credentials with ID:', existingCredentials.id);
      // Update existing record
      const { data, error } = await adminSupabase
        .from('api_credentials')
        .update(credentialsData)
        .eq('id', existingCredentials.id)
        .select('*')
        .single();
        
      if (error) {
        console.error('Error updating credentials:', error);
        throw new Error(`Failed to update credentials: ${error.message}`);
      } else {
        credentials = data;
        console.log('Updated credentials successfully:', credentials);
      }
    } else {
      console.log('Inserting new credentials');
      // Insert new record
      const { data, error } = await adminSupabase
        .from('api_credentials')
        .insert(credentialsData)
        .select('*')
        .single();
        
      if (error) {
        console.error('Error inserting credentials:', error);
        throw new Error(`Failed to insert credentials: ${error.message}`);
      } else {
        credentials = data;
        console.log('Inserted credentials successfully:', credentials);
      }
    }

    // Success!
    console.log('Config saved successfully');

    // Convert api_credentials format to the expected API response format
    let apiResponse: any = {
      type: credentials.type,
      empresa: credentials.empresa,
      codigo: credentials.codigo,
      chave: credentials.chave,
      tipoSaida: 'json',
      isConfigured: true
    };
    
    // Add type-specific fields if needed
    if (config.type === 'employee') {
      apiResponse.ativo = credentials.ativo || 'Sim';
      apiResponse.inativo = credentials.inativo || '';
      apiResponse.afastado = credentials.afastado || '';
      apiResponse.pendente = credentials.pendente || '';
      apiResponse.ferias = credentials.ferias || '';
    } else if (config.type === 'absenteeism') {
      // Map from database naming to API naming
      apiResponse.empresaTrabalho = credentials.empresatrabalho || '';
      apiResponse.dataInicio = credentials.datainicio || '';
      apiResponse.dataFim = credentials.datafim || '';
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
