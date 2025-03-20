
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SOC_API_URL = 'https://ws1.soc.com.br/WebSoc/exportadados';

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Extract token
    const token = authHeader.replace('Bearer ', '');

    // Create admin Supabase client
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify the token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    // Get request body
    const requestData = await req.json();
    const { type, params } = requestData;

    if (!type || !params) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing required parameters: type and params' }),
        { status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Validate type - only allow employee and absenteeism
    if (type !== 'employee' && type !== 'absenteeism') {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid type. Only "employee" and "absenteeism" are supported.' }),
        { status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sync request for type ${type} with params:`, params);

    // Create a sync log entry
    const { data: syncLog, error: syncLogError } = await supabaseAdmin
      .from('sync_logs')
      .insert({
        type,
        status: 'started',
        message: `Synchronizing ${type} data`,
        user_id: user.id,
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (syncLogError) {
      console.error('Error creating sync log entry:', syncLogError);
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to create sync log entry' }),
        { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    console.log('Created sync log entry:', syncLog.id);

    // Format parameters for the SOC API
    const formattedParams = JSON.stringify(params);
    const apiUrl = `${SOC_API_URL}?parametro=${encodeURIComponent(formattedParams)}`;

    console.log('Calling SOC API at:', apiUrl);

    // Update sync log status to processing
    await supabaseAdmin
      .from('sync_logs')
      .update({
        status: 'processing',
        message: `Processing ${type} data from SOC API`
      })
      .eq('id', syncLog.id);

    // Start the background task to call the API and process data
    const syncId = syncLog.id;
    const userId = user.id;
    
    // Run the heavy processing in the background with waitUntil
    // Esta é a parte importante que garante que todo processamento seja feito em segundo plano
    EdgeRuntime.waitUntil((async () => {
      try {
        console.log(`Processing ${type} data in background for sync ID ${syncId}`);
        
        // Make the API request
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          throw new Error(`API request failed with status: ${response.status}`);
        }
        
        // Get the text response and decode it from latin-1
        const responseBuffer = await response.arrayBuffer();
        const decoder = new TextDecoder('latin1');
        const decodedContent = decoder.decode(responseBuffer);
        
        // Parse the JSON response
        let jsonData;
        try {
          jsonData = JSON.parse(decodedContent);
        } catch (e) {
          console.error('Error parsing JSON:', e);
          throw new Error(`Invalid JSON response: ${e.message}`);
        }
        
        if (!Array.isArray(jsonData)) {
          throw new Error('API did not return an array of records');
        }
        
        console.log(`Received ${jsonData.length} records from SOC API for ${type}`);
        
        // Update sync log with total count
        await supabaseAdmin
          .from('sync_logs')
          .update({
            message: `Processing ${jsonData.length} ${type} records`
          })
          .eq('id', syncId);
        
        // Processando todos os dados de uma vez, sem usar batch
        let result;
        switch (type) {
          case 'employee':
            result = await processEmployeeData(supabaseAdmin, jsonData, userId);
            break;
          case 'absenteeism':
            result = await processAbsenteeismData(supabaseAdmin, jsonData, userId);
            break;
          default:
            throw new Error(`Unsupported data type: ${type}`);
        }
        
        // Update sync log with completion status
        await supabaseAdmin
          .from('sync_logs')
          .update({
            status: 'completed',
            message: `Synchronization completed: ${jsonData.length} ${type} records processed`,
            completed_at: new Date().toISOString()
          })
          .eq('id', syncId);
        
        console.log(`Sync ID ${syncId} for ${type} completed successfully`);
      } catch (error) {
        console.error(`Error processing ${type} data for sync ID ${syncId}:`, error);
        
        // Update sync log with error
        await supabaseAdmin
          .from('sync_logs')
          .update({
            status: 'error',
            message: `Error: ${error.message}`,
            error_details: error.stack,
            completed_at: new Date().toISOString()
          })
          .eq('id', syncId);
      }
    })());

    // Return immediate success response
    return new Response(
      JSON.stringify({
        success: true,
        message: `Synchronization job for ${type} started successfully`,
        syncId: syncLog.id
      }),
      { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message || 'An unexpected error occurred'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Function to process all employee data
async function processEmployeeData(supabase, data, userId) {
  console.log(`Processing ${data.length} employee records at once`);
  
  const employeeData = data.map(item => ({
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
    birth_date: item.DATA_NASCIMENTO ? new Date(item.DATA_NASCIMENTO) : null,
    hire_date: item.DATA_ADMISSAO ? new Date(item.DATA_ADMISSAO) : null,
    termination_date: item.DATA_DEMISSAO ? new Date(item.DATA_DEMISSAO) : null,
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
    last_update_date: item.DATAULTERACAO ? new Date(item.DATAULTERACAO) : null,
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
  
  const { data: result, error } = await supabase
    .from('employees')
    .upsert(employeeData, {
      onConflict: 'soc_code, user_id',
      ignoreDuplicates: false
    });
  
  if (error) {
    console.error('Error upserting employees:', error);
    throw error;
  }
  
  return { count: employeeData.length };
}

// Function to process all absenteeism data
async function processAbsenteeismData(supabase, data, userId) {
  console.log(`Processing ${data.length} absenteeism records at once`);
  
  const absenteeismData = data.map(item => ({
    unit: item.UNIDADE,
    sector: item.SETOR,
    employee_registration: item.MATRICULA_FUNC,
    birth_date: item.DT_NASCIMENTO ? new Date(item.DT_NASCIMENTO) : null,
    gender: item.SEXO,
    certificate_type: item.TIPO_ATESTADO,
    start_date: item.DT_INICIO_ATESTADO ? new Date(item.DT_INICIO_ATESTADO) : new Date(),
    end_date: item.DT_FIM_ATESTADO ? new Date(item.DT_FIM_ATESTADO) : new Date(),
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
  
  const { data: result, error } = await supabase
    .from('absenteeism')
    .insert(absenteeismData);
  
  if (error) {
    console.error('Error inserting absenteeism records:', error);
    throw error;
  }
  
  return { count: absenteeismData.length };
}
