
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

type ApiConfigType = 'company' | 'employee' | 'absenteeism';

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Parse the URL to get the type parameter
  const url = new URL(req.url);
  const type = url.pathname.split('/').pop() as ApiConfigType;
  
  if (!type || !['company', 'employee', 'absenteeism'].includes(type)) {
    return new Response(
      JSON.stringify({ error: 'Tipo de configuração API inválido' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    // Get session for authentication
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado - Faça login para continuar' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Retrieving ${type} API configuration for user ${session.user.id}`)
    
    // Get the API configuration from the database
    const { data: config, error } = await supabase
      .from('api_configs')
      .select('*')
      .eq('type', type)
      .eq('user_id', session.user.id)
      .maybeSingle();
    
    if (error) {
      console.error('Error retrieving API configuration:', error);
      return new Response(
        JSON.stringify({ error: 'Erro ao recuperar configuração da API' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // If no configuration is found, return null
    if (!config) {
      return new Response(
        JSON.stringify(null),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Transform the data to match the expected response format
    const transformedResponse = {
      type: config.type,
      empresa: config.empresa,
      codigo: config.codigo,
      chave: config.chave,
      tipoSaida: config.tiposaida || 'json',
      isConfigured: true
    };
    
    // Add type-specific properties
    if (type === 'employee') {
      transformedResponse.ativo = config.ativo || 'Sim';
      transformedResponse.inativo = config.inativo || '';
      transformedResponse.afastado = config.afastado || '';
      transformedResponse.pendente = config.pendente || '';
      transformedResponse.ferias = config.ferias || '';
    } else if (type === 'absenteeism') {
      transformedResponse.empresaTrabalho = config.empresatrabalho || '';
      transformedResponse.dataInicio = config.datainicio || '';
      transformedResponse.dataFim = config.datafim || '';
    }
    
    return new Response(
      JSON.stringify(transformedResponse),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar a requisição' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
