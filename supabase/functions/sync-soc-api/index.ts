import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/cors.ts';
import { decode as decodeBase64 } from 'https://deno.land/std@0.177.0/encoding/base64.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

interface SocApiParams {
  empresa: string;
  codigo: string;
  chave: string;
  tipoSaida: string;
  [key: string]: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Get the session
    const { data: { session } } = await supabase.auth.getSession();

    // Check if user is authenticated
    if (!session) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Not authenticated' 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse the request body
    const requestData = await req.json();
    console.log('Request data:', requestData);

    // Validate required parameters
    if (!requestData.type || !requestData.params) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Missing required fields: type and params are required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log sync start
    const logEntry = {
      type: requestData.type,
      status: 'started',
      message: `Iniciando sincronização de ${requestData.type}`,
      user_id: session.user.id,
      started_at: new Date().toISOString()
    };

    const { data: syncLog, error: logError } = await supabase
      .from('sync_logs')
      .insert(logEntry)
      .select()
      .single();

    if (logError) {
      console.error('Error creating sync log entry:', logError);
    }

    // Call the SOC API
    const params: SocApiParams = requestData.params;
    const url = 'https://ws1.soc.com.br/WebSoc/exportadados?parametro=' + encodeURIComponent(JSON.stringify(params));
    
    console.log(`Calling SOC API: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      // Update log with error
      if (syncLog) {
        await supabase
          .from('sync_logs')
          .update({
            status: 'error',
            message: `Erro ao chamar API SOC: ${response.status} ${response.statusText}`,
            error_details: await response.text(),
            completed_at: new Date().toISOString()
          })
          .eq('id', syncLog.id);
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Error from SOC API: ${response.status} ${response.statusText}` 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }

    // SOC API returns data in Latin-1 encoding
    const responseBuffer = await response.arrayBuffer();
    const decoder = new TextDecoder('latin1');
    const decodedContent = decoder.decode(responseBuffer);
    
    // Parse JSON response
    let data;
    try {
      data = JSON.parse(decodedContent);
    } catch (e) {
      console.error('Error parsing JSON response:', e);
      console.log('First 200 chars of response:', decodedContent.substring(0, 200));
      
      // Update log with error
      if (syncLog) {
        await supabase
          .from('sync_logs')
          .update({
            status: 'error',
            message: 'Erro ao processar resposta da API SOC: formato inválido',
            error_details: e.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', syncLog.id);
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Invalid JSON response from SOC API' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }

    // Process and save data based on type
    let processingResult;
    
    if (requestData.type === 'employee') {
      processingResult = await processEmployeeData(supabase, data, session.user.id);
    } else if (requestData.type === 'absenteeism') {
      processingResult = await processAbsenteeismData(supabase, data, session.user.id);
    } else if (requestData.type === 'company') {
      processingResult = await processCompanyData(supabase, data, session.user.id);
    } else {
      processingResult = {
        success: false,
        message: `Unsupported data type: ${requestData.type}`
      };
    }

    // Update sync log
    if (syncLog) {
      await supabase
        .from('sync_logs')
        .update({
          status: processingResult.success ? 'completed' : 'error',
          message: processingResult.message,
          error_details: processingResult.error,
          completed_at: new Date().toISOString()
        })
        .eq('id', syncLog.id);
    }

    return new Response(
      JSON.stringify(processingResult),
      { 
        status: processingResult.success ? 200 : 500, 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message || 'An unexpected error occurred',
        error: error.stack
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Helper functions to process different data types

async function processEmployeeData(supabase, data, userId) {
  try {
    console.log(`Processing employee data: ${data.length} records`);
    
    if (!Array.isArray(data)) {
      return { success: false, message: 'Invalid employee data: not an array', error: 'Data is not an array' };
    }
    
    // Transform employee data for insertion
    const employees = data.map(emp => ({
      soc_code: emp.CODIGO,
      company_soc_code: emp.CODIGOEMPRESA,
      company_name: emp.NOMEEMPRESA,
      full_name: emp.NOME,
      unit_code: emp.CODIGOUNIDADE,
      unit_name: emp.NOMEUNIDADE,
      sector_code: emp.CODIGOSETOR,
      sector_name: emp.NOMESETOR,
      position_code: emp.CODIGOCARGO,
      position_name: emp.NOMECARGO,
      position_cbo: emp.CBOCARGO,
      cost_center: emp.CCUSTO,
      cost_center_name: emp.NOMECENTROCUSTO,
      employee_registration: emp.MATRICULAFUNCIONARIO,
      cpf: emp.CPF,
      rg: emp.RG,
      rg_state: emp.UFRG,
      rg_issuer: emp.ORGAOEMISSORRG,
      status: emp.SITUACAO,
      gender: emp.SEXO,
      pis: emp.PIS,
      work_card: emp.CTPS,
      work_card_series: emp.SERIECTPS,
      marital_status: emp.ESTADOCIVIL,
      contract_type: emp.TIPOCONTATACAO,
      birth_date: emp.DATA_NASCIMENTO ? new Date(emp.DATA_NASCIMENTO) : null,
      hire_date: emp.DATA_ADMISSAO ? new Date(emp.DATA_ADMISSAO) : null,
      termination_date: emp.DATA_DEMISSAO ? new Date(emp.DATA_DEMISSAO) : null,
      address: emp.ENDERECO,
      address_number: emp.NUMERO_ENDERECO,
      neighborhood: emp.BAIRRO,
      city: emp.CIDADE,
      state: emp.UF,
      zip_code: emp.CEP,
      home_phone: emp.TELEFONERESIDENCIAL,
      mobile_phone: emp.TELEFONECELULAR,
      email: emp.EMAIL,
      is_disabled: emp.DEFICIENTE === 1,
      disability_description: emp.DEFICIENCIA,
      mother_name: emp.NM_MAE_FUNCIONARIO,
      last_update_date: emp.DATAULTALTERACAO ? new Date(emp.DATAULTALTERACAO) : null,
      hr_registration: emp.MATRICULARH,
      skin_color: emp.COR,
      education: emp.ESCOLARIDADE,
      birthplace: emp.NATURALIDADE,
      extension: emp.RAMAL,
      shift_regime: emp.REGIMEREVEZAMENTO,
      work_regime: emp.REGIMETRABALHO,
      commercial_phone: emp.TELCOMERCIAL,
      work_shift: emp.TURNOTRABALHO,
      hr_unit: emp.RHUNIDADE,
      hr_sector: emp.RHSETOR,
      hr_position: emp.RHCARGO,
      hr_cost_center_unit: emp.RHCENTROCUSTOUNIDADE,
      user_id: userId
    }));
    
    // Batch insert or update employees (upsert)
    let processed = 0;
    const batchSize = 100; // Insert 100 records at a time
    
    for (let i = 0; i < employees.length; i += batchSize) {
      const batch = employees.slice(i, i + batchSize);
      
      const { error } = await supabase.from('employees').upsert(
        batch,
        { 
          onConflict: 'soc_code, user_id',
          ignoreDuplicates: false
        }
      );
      
      if (error) {
        console.error(`Error inserting employee batch ${i}-${i+batchSize}:`, error);
        throw error;
      }
      
      processed += batch.length;
      console.log(`Processed ${processed}/${employees.length} employee records`);
    }
    
    return { 
      success: true, 
      message: `Successfully processed ${processed} employee records`,
      processed
    };
  } catch (error) {
    console.error('Error processing employee data:', error);
    return { 
      success: false, 
      message: 'Error processing employee data', 
      error: error.message || error
    };
  }
}

async function processAbsenteeismData(supabase, data, userId) {
  try {
    console.log(`Processing absenteeism data: ${data.length} records`);
    
    if (!Array.isArray(data)) {
      return { success: false, message: 'Invalid absenteeism data: not an array', error: 'Data is not an array' };
    }
    
    // Transform absenteeism data for insertion
    const absenteeismRecords = data.map(record => ({
      unit: record.UNIDADE,
      sector: record.SETOR,
      employee_registration: record.MATRICULA_FUNC,
      birth_date: record.DT_NASCIMENTO ? new Date(record.DT_NASCIMENTO) : null,
      gender: record.SEXO,
      certificate_type: record.TIPO_ATESTADO,
      start_date: record.DT_INICIO_ATESTADO ? new Date(record.DT_INICIO_ATESTADO) : null,
      end_date: record.DT_FIM_ATESTADO ? new Date(record.DT_FIM_ATESTADO) : null,
      start_time: record.HORA_INICIO_ATESTADO,
      end_time: record.HORA_FIM_ATESTADO,
      days_absent: record.DIAS_AFASTADOS,
      hours_absent: record.HORAS_AFASTADO,
      primary_icd: record.CID_PRINCIPAL,
      icd_description: record.DESCRICAO_CID,
      pathological_group: record.GRUPO_PATOLOGICO,
      license_type: record.TIPO_LICENCA,
      user_id: userId
    }));
    
    // Batch insert absenteeism records
    let processed = 0;
    const batchSize = 100; // Insert 100 records at a time
    
    for (let i = 0; i < absenteeismRecords.length; i += batchSize) {
      const batch = absenteeismRecords.slice(i, i + batchSize);
      
      const { error } = await supabase.from('absenteeism').insert(batch);
      
      if (error) {
        console.error(`Error inserting absenteeism batch ${i}-${i+batchSize}:`, error);
        throw error;
      }
      
      processed += batch.length;
      console.log(`Processed ${processed}/${absenteeismRecords.length} absenteeism records`);
    }
    
    return { 
      success: true, 
      message: `Successfully processed ${processed} absenteeism records`,
      processed
    };
  } catch (error) {
    console.error('Error processing absenteeism data:', error);
    return { 
      success: false, 
      message: 'Error processing absenteeism data', 
      error: error.message || error
    };
  }
}

async function processCompanyData(supabase, data, userId) {
  try {
    console.log(`Processing company data: ${data.length} records`);
    
    if (!Array.isArray(data)) {
      return { success: false, message: 'Invalid company data: not an array', error: 'Data is not an array' };
    }
    
    // Transform company data for insertion
    const companies = data.map(company => ({
      soc_code: company.CODIGO,
      short_name: company.NOMEABREVIADO,
      initial_corporate_name: company.RAZAOSOCIALINICIAL,
      corporate_name: company.RAZAOSOCIAL,
      address: company.ENDERECO,
      address_number: company.NUMEROENDERECO,
      address_complement: company.COMPLEMENTOENDERECO,
      neighborhood: company.BAIRRO,
      city: company.CIDADE,
      zip_code: company.CEP,
      state: company.UF,
      tax_id: company.CNPJ,
      state_registration: company.INSCRICAOESTADUAL,
      municipal_registration: company.INSCRICAOMUNICIPAL,
      is_active: company.ATIVO === 1,
      integration_client_code: company.CODIGOCLIENTEINTEGRACAO,
      client_code: company.CÓD ? company.CÓD.CLIENTE : null,
      user_id: userId
    }));
    
    // Batch insert or update companies (upsert)
    let processed = 0;
    const batchSize = 50; // Insert 50 records at a time
    
    for (let i = 0; i < companies.length; i += batchSize) {
      const batch = companies.slice(i, i + batchSize);
      
      const { error } = await supabase.from('companies').upsert(
        batch,
        { 
          onConflict: 'soc_code, user_id',
          ignoreDuplicates: false
        }
      );
      
      if (error) {
        console.error(`Error inserting company batch ${i}-${i+batchSize}:`, error);
        throw error;
      }
      
      processed += batch.length;
      console.log(`Processed ${processed}/${companies.length} company records`);
    }
    
    return { 
      success: true, 
      message: `Successfully processed ${processed} company records`,
      processed
    };
  } catch (error) {
    console.error('Error processing company data:', error);
    return { 
      success: false, 
      message: 'Error processing company data', 
      error: error.message || error
    };
  }
}
