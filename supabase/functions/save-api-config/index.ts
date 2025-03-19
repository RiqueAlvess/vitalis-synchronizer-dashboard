
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

interface ApiConfig {
  type: 'company' | 'employee' | 'absenteeism';
  empresa: string;
  codigo: string;
  chave: string;
  tipoSaida: string;
  isConfigured?: boolean;
  [key: string]: any;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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

    // Get config data from request
    const config: ApiConfig = await req.json()
    
    if (!config || !config.type || !config.empresa || !config.codigo || !config.chave) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros de configuração ausentes ou inválidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log(`Saving ${config.type} API configuration`, { 
      empresa: config.empresa, 
      type: config.type 
    })
    
    try {
      // Create the record to save
      const recordToSave = {
        user_id: session.user.id,
        type: config.type,
        empresa: config.empresa,
        codigo: config.codigo,
        chave: config.chave,
        tiposaida: config.tipoSaida || 'json',
      };
      
      // Add type-specific fields
      if (config.type === 'employee') {
        recordToSave.ativo = config.ativo || 'Sim';
        recordToSave.inativo = config.inativo || '';
        recordToSave.afastado = config.afastado || '';
        recordToSave.pendente = config.pendente || '';
        recordToSave.ferias = config.ferias || '';
      } else if (config.type === 'absenteeism') {
        recordToSave.empresatrabalho = config.empresaTrabalho || '';
        recordToSave.datainicio = config.dataInicio || '';
        recordToSave.datafim = config.dataFim || '';
      }
      
      // Perform upsert operation (insert or update)
      const { data: savedConfig, error } = await supabase
        .from('api_configs')
        .upsert(recordToSave, {
          onConflict: 'user_id, type',
          returning: 'representation'
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error saving API configuration:', error);
        throw error;
      }
      
      // Transform the saved data back to match the expected response format
      const transformedResponse = {
        type: savedConfig.type,
        empresa: savedConfig.empresa,
        codigo: savedConfig.codigo,
        chave: savedConfig.chave,
        tipoSaida: savedConfig.tiposaida || 'json',
        isConfigured: true
      };
      
      // Add type-specific properties
      if (config.type === 'employee') {
        transformedResponse.ativo = savedConfig.ativo || 'Sim';
        transformedResponse.inativo = savedConfig.inativo || '';
        transformedResponse.afastado = savedConfig.afastado || '';
        transformedResponse.pendente = savedConfig.pendente || '';
        transformedResponse.ferias = savedConfig.ferias || '';
      } else if (config.type === 'absenteeism') {
        transformedResponse.empresaTrabalho = savedConfig.empresatrabalho || '';
        transformedResponse.dataInicio = savedConfig.datainicio || '';
        transformedResponse.dataFim = savedConfig.datafim || '';
      }
      
      return new Response(
        JSON.stringify(transformedResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (saveError) {
      console.error('Error in save operation:', saveError);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar configuração da API' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar a requisição' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
