
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SOC_API_URL = 'https://ws1.soc.com.br/WebSoc/exportadados';

// Função para chamar a API do SOC diretamente e processar os resultados
async function callSocApi(params: Record<string, string>) {
  console.log('Calling SOC API with params:', params);
  
  try {
    // Formatar os parâmetros para a API do SOC
    const formattedParams = JSON.stringify(params);
    const apiUrl = `${SOC_API_URL}?parametro=${encodeURIComponent(formattedParams)}`;
    
    console.log(`API URL: ${apiUrl}`);
    
    // Fazer a requisição para a API
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status}`);
    }
    
    // Decodificar a resposta latin-1
    const responseBuffer = await response.arrayBuffer();
    const decoder = new TextDecoder('latin1');
    const decodedContent = decoder.decode(responseBuffer);
    
    // Tentar parsear a resposta como JSON
    try {
      const jsonData = JSON.parse(decodedContent);
      console.log(`Received ${Array.isArray(jsonData) ? jsonData.length : 0} records from SOC API`);
      return jsonData;
    } catch (e) {
      console.error('Error parsing JSON:', e);
      throw new Error(`Invalid JSON response: ${e.message}`);
    }
  } catch (error) {
    console.error('Error calling SOC API:', error);
    throw error;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    // Get the Authorization header
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ success: false, message: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Extract the token from the Authorization header
    const token = authHeader.replace('Bearer ', '');
    
    // Create client with admin role
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
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Invalid token:', authError?.message);
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { type, params } = await req.json();
    console.log('Sync request received:', { type, params });

    // Check if type is valid
    if (!['company', 'employee', 'absenteeism'].includes(type)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid sync type' }),
        { status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Create sync log entry
    const { data: logData, error: logError } = await supabaseAdmin
      .from('sync_logs')
      .insert({
        user_id: user.id,
        type,
        status: 'processing',
        message: `Processando sincronização de ${type}`,
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (logError) {
      console.error('Error creating sync log:', logError);
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to create sync log' }),
        { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Iniciar processamento em segundo plano
    const syncId = logData.id;
    
    console.log(`Starting background processing for ${type} sync with ID: ${syncId}`);
    
    // Usar EdgeRuntime.waitUntil para processar em segundo plano
    EdgeRuntime.waitUntil((async () => {
      try {
        console.log(`Background sync processing started for ${type} with sync ID: ${syncId}`);
        
        // Atualizar log de sincronização para status "processing"
        await supabaseAdmin
          .from('sync_logs')
          .update({
            status: 'processing',
            message: `Processando dados de ${type}...`
          })
          .eq('id', syncId);
        
        // Chamar a API do SOC e processar os resultados
        console.log(`Calling SOC API for ${type} data...`);
        const socData = await callSocApi(params);
        
        if (!Array.isArray(socData)) {
          throw new Error('API did not return an array of records');
        }
        
        console.log(`Processing ${socData.length} ${type} records...`);
        
        // Processar dados com base no tipo
        let result;
        switch (type) {
          case 'company':
            // Processar dados de empresa
            result = await processCompanyData(supabaseAdmin, socData, user.id);
            break;
          case 'employee':
            // Processar dados de funcionário
            result = await processEmployeeData(supabaseAdmin, socData, user.id);
            break;
          case 'absenteeism':
            // Processar dados de absenteísmo
            result = await processAbsenteeismData(supabaseAdmin, socData, user.id);
            break;
          default:
            throw new Error(`Unsupported sync type: ${type}`);
        }
        
        // Atualizar log de sincronização para status "completed"
        await supabaseAdmin
          .from('sync_logs')
          .update({
            status: 'completed',
            message: `Sincronização de ${type} concluída com sucesso. Processados ${result.count} registros.`,
            completed_at: new Date().toISOString()
          })
          .eq('id', syncId);
        
        console.log(`Sync ${syncId} completed successfully. Processed ${result.count} records.`);
      } catch (error) {
        console.error(`Error in background sync processing for ${type}:`, error);
        
        // Atualizar log de sincronização com erro
        await supabaseAdmin
          .from('sync_logs')
          .update({
            status: 'error',
            message: `Erro na sincronização de ${type}: ${error.message}`,
            error_details: error.stack,
            completed_at: new Date().toISOString()
          })
          .eq('id', syncId);
      }
    })());
    
    // Retornar resposta imediatamente
    return new Response(
      JSON.stringify({
        success: true,
        message: `Sincronização de ${type} iniciada`,
        syncId: syncId
      }),
      { status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message || 'An unexpected error occurred',
        stack: error.stack 
      }),
      { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});

// Função para processar dados de empresa
async function processCompanyData(supabase, data, userId) {
  console.log(`Processing ${data.length} company records`);
  
  const companyData = data.map(item => ({
    soc_code: item.CODIGO,
    short_name: item.NOMEABREVIADO,
    corporate_name: item.RAZAOSOCIAL,
    initial_corporate_name: item.RAZAOSOCIALINICIAL,
    address: item.ENDERECO,
    address_number: item.NUMEROENDERECO,
    address_complement: item.COMPLEMENTOENDERECO,
    neighborhood: item.BAIRRO,
    city: item.CIDADE,
    zip_code: item.CEP,
    state: item.UF,
    tax_id: item.CNPJ,
    state_registration: item.INSCRICAOESTADUAL,
    municipal_registration: item.INSCRICAOMUNICIPAL,
    is_active: item.ATIVO === 1,
    integration_client_code: item.CODIGOCLIENTEINTEGRACAO,
    client_code: item['CÓD. CLIENTE'],
    user_id: userId
  }));
  
  if (companyData.length === 0) {
    return { count: 0 };
  }
  
  const { data: result, error } = await supabase
    .from('companies')
    .upsert(companyData, {
      onConflict: 'soc_code, user_id',
      ignoreDuplicates: false
    });
  
  if (error) {
    console.error('Error upserting companies:', error);
    throw error;
  }
  
  return { count: companyData.length };
}

// Função para processar dados de funcionário
async function processEmployeeData(supabase, data, userId) {
  console.log(`Processing ${data.length} employee records`);
  
  // Processar em batches para evitar limites de tamanho
  const batchSize = 50;
  let processedCount = 0;
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    const employeeData = batch.map(item => ({
      soc_code: item.CODIGO,
      company_soc_code: item.CODIGOEMPRESA,
      company_name: item.NOMEEMPRESA,
      full_name: item.NOME,
      unit_code: item.CODIGOUNIDADE,
      unit_name: item.NOMEUNIDADE,
      sector_code: item.CODIGOSETOR,
      sector_name: item.NOMESETOR,
      position_code: item.CODIGOCARGO,
      position_name: item.NOMECARGO,
      position_cbo: item.CBOCARGO,
      cost_center: item.CCUSTO,
      cost_center_name: item.NOMECENTROCUSTO,
      employee_registration: item.MATRICULAFUNCIONARIO,
      cpf: item.CPF,
      rg: item.RG,
      rg_state: item.UFRG,
      rg_issuer: item.ORGAOEMISSORRG,
      status: item.SITUACAO,
      gender: item.SEXO,
      pis: item.PIS,
      work_card: item.CTPS,
      work_card_series: item.SERIECTPS,
      marital_status: item.ESTADOCIVIL,
      contract_type: item.TIPOCONTATACAO,
      birth_date: item.DATA_NASCIMENTO ? new Date(item.DATA_NASCIMENTO).toISOString() : null,
      hire_date: item.DATA_ADMISSAO ? new Date(item.DATA_ADMISSAO).toISOString() : null,
      termination_date: item.DATA_DEMISSAO ? new Date(item.DATA_DEMISSAO).toISOString() : null,
      address: item.ENDERECO,
      address_number: item.NUMERO_ENDERECO,
      neighborhood: item.BAIRRO,
      city: item.CIDADE,
      state: item.UF,
      zip_code: item.CEP,
      home_phone: item.TELEFONERESIDENCIAL,
      mobile_phone: item.TELEFONECELULAR,
      email: item.EMAIL,
      is_disabled: item.DEFICIENTE === 1,
      disability_description: item.DEFICIENCIA,
      mother_name: item.NM_MAE_FUNCIONARIO,
      last_update_date: item.DATAULTALTERACAO ? new Date(item.DATAULTALTERACAO).toISOString() : null,
      hr_registration: item.MATRICULARH,
      skin_color: item.COR,
      education: item.ESCOLARIDADE,
      birthplace: item.NATURALIDADE,
      extension: item.RAMAL,
      shift_regime: item.REGIMEREVEZAMENTO,
      work_regime: item.REGIMETRABALHO,
      commercial_phone: item.TELCOMERCIAL,
      work_shift: item.TURNOTRABALHO,
      hr_unit: item.RHUNIDADE,
      hr_sector: item.RHSETOR,
      hr_position: item.RHCARGO,
      hr_cost_center_unit: item.RHCENTROCUSTOUNIDADE,
      user_id: userId
    }));
    
    if (employeeData.length === 0) continue;
    
    const { error } = await supabase
      .from('employees')
      .upsert(employeeData, {
        onConflict: 'soc_code, user_id',
        ignoreDuplicates: false
      });
    
    if (error) {
      console.error('Error upserting employees:', error);
      throw error;
    }
    
    processedCount += employeeData.length;
    console.log(`Processed batch ${i}-${i + employeeData.length} of ${data.length} employees`);
  }
  
  return { count: processedCount };
}

// Função para processar dados de absenteísmo
async function processAbsenteeismData(supabase, data, userId) {
  console.log(`Processing ${data.length} absenteeism records`);
  
  // Processar em batches para evitar limites de tamanho
  const batchSize = 50;
  let processedCount = 0;
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    const absenteeismData = batch.map(item => ({
      unit: item.UNIDADE,
      sector: item.SETOR,
      employee_registration: item.MATRICULA_FUNC,
      birth_date: item.DT_NASCIMENTO ? new Date(item.DT_NASCIMENTO).toISOString() : null,
      gender: item.SEXO,
      certificate_type: item.TIPO_ATESTADO,
      start_date: item.DT_INICIO_ATESTADO ? new Date(item.DT_INICIO_ATESTADO).toISOString() : new Date().toISOString(),
      end_date: item.DT_FIM_ATESTADO ? new Date(item.DT_FIM_ATESTADO).toISOString() : new Date().toISOString(),
      start_time: item.HORA_INICIO_ATESTADO,
      end_time: item.HORA_FIM_ATESTADO,
      days_absent: item.DIAS_AFASTADOS,
      hours_absent: item.HORAS_AFASTADO,
      primary_icd: item.CID_PRINCIPAL,
      icd_description: item.DESCRICAO_CID,
      pathological_group: item.GRUPO_PATOLOGICO,
      license_type: item.TIPO_LICENCA,
      user_id: userId
    }));
    
    if (absenteeismData.length === 0) continue;
    
    const { error } = await supabase
      .from('absenteeism')
      .insert(absenteeismData);
    
    if (error) {
      console.error('Error inserting absenteeism records:', error);
      throw error;
    }
    
    processedCount += absenteeismData.length;
    console.log(`Processed batch ${i}-${i + absenteeismData.length} of ${data.length} absenteeism records`);
  }
  
  return { count: processedCount };
}
