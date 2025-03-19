
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

interface ApiParams {
  type: 'company' | 'employee' | 'absenteeism';
  empresa: string;
  codigo: string;
  chave: string;
  tipoSaida: string;
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
        JSON.stringify({ success: false, message: 'Não autorizado - Faça login para continuar' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get API parameters from request
    const params: ApiParams = await req.json()
    
    if (!params || !params.type || !params.empresa || !params.codigo || !params.chave) {
      return new Response(
        JSON.stringify({ success: false, message: 'Parâmetros de API ausentes ou inválidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log(`Testing ${params.type} API connection`, { empresa: params.empresa })
    
    // Build the API URL based on the params type
    const socApiUrl = 'https://ws1.soc.com.br/WebSoc/exportadados'
    
    // Set up API parameters based on the type
    const apiParams: Record<string, string> = {
      empresa: params.empresa,
      codigo: params.codigo,
      chave: params.chave,
      tipoSaida: params.tipoSaida || 'json'
    };
    
    // Add type-specific parameters
    if (params.type === 'employee') {
      apiParams.ativo = params.ativo || 'Sim';
      if (params.inativo) apiParams.inativo = params.inativo;
      if (params.afastado) apiParams.afastado = params.afastado;
      if (params.pendente) apiParams.pendente = params.pendente;
      if (params.ferias) apiParams.ferias = params.ferias;
    } else if (params.type === 'absenteeism') {
      if (params.empresaTrabalho) apiParams.empresaTrabalho = params.empresaTrabalho;
      if (params.dataInicio) apiParams.dataInicio = params.dataInicio;
      if (params.dataFim) apiParams.dataFim = params.dataFim;
    }
    
    try {
      // Test the connection by making a request to the SOC API
      const response = await fetch(`${socApiUrl}?parametro=${JSON.stringify(apiParams)}`);
      
      if (!response.ok) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: `Erro na API SOC: ${response.status} ${response.statusText}` 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Try to decode and parse the response to validate it
      const textData = await response.text();
      const decodedData = new TextDecoder('latin1').decode(new TextEncoder().encode(textData));
      
      try {
        const jsonData = JSON.parse(decodedData);
        
        // Check if the response is an error message or has valid data
        if (Array.isArray(jsonData) && jsonData.length > 0) {
          // Save the successful config to the database
          const { error: saveError } = await supabase
            .from('api_configs')
            .upsert(
              {
                user_id: session.user.id,
                type: params.type,
                ...apiParams
              },
              { onConflict: 'user_id, type' }
            );
          
          if (saveError) {
            console.error('Error saving API config:', saveError);
          }
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: `Conexão estabelecida com sucesso! Retornados ${jsonData.length} registros.`,
              count: jsonData.length
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: 'A API retornou dados inválidos ou vazios. Verifique suas credenciais.' 
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (parseError) {
        console.error('Error parsing API response:', parseError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Erro ao analisar a resposta da API. O formato retornado é inválido.' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (apiError) {
      console.error('Error calling SOC API:', apiError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Erro ao conectar com a API SOC. Verifique suas credenciais e conexão.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
  } catch (error) {
    console.error('Error in API test connection:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Erro interno ao processar o teste de conexão API.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
