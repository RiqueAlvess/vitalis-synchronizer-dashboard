
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SOC_API_URL = 'https://ws1.soc.com.br/WebSoc/exportadados';

interface SyncOptions {
  type: 'company' | 'employee' | 'absenteeism';
  params: Record<string, string>;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Get the session to verify authentication
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return new Response(
        JSON.stringify({ success: false, message: 'Not authenticated' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Parse the request body
    const options: SyncOptions = await req.json();
    
    if (!options || !options.type || !options.params) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid request: missing type or params' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log(`Syncing ${options.type} data with params:`, options.params);
    
    // Create a sync log entry
    const { data: logEntry, error: logError } = await supabase
      .from('sync_logs')
      .insert({
        type: options.type,
        status: 'pending',
        message: `Sincronização de ${options.type} iniciada`,
        user_id: session.user.id
      })
      .select()
      .single();
    
    if (logError) {
      console.error('Error creating sync log:', logError);
      return new Response(
        JSON.stringify({ success: false, message: 'Falha ao criar registro de sincronização' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Update log to in-progress
    await supabase
      .from('sync_logs')
      .update({ 
        status: 'in_progress',
        message: `Sincronização de ${options.type} em andamento`
      })
      .eq('id', logEntry.id);
    
    try {
      // Format request parameters for SOC API
      const formattedParams = JSON.stringify(options.params);
      const apiUrl = `${SOC_API_URL}?parametro=${encodeURIComponent(formattedParams)}`;
      
      console.log(`Calling SOC API at: ${apiUrl}`);
      
      // Make the API request
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`API request failed with status: ${response.status}`);
      }
      
      // Get the text response and decode it from latin-1
      const textResponse = await response.text();
      const decodedResponse = new TextDecoder('latin1').decode(new TextEncoder().encode(textResponse));
      
      // Parse the JSON response
      const jsonData = JSON.parse(decodedResponse);
      
      if (!Array.isArray(jsonData)) {
        throw new Error('API did not return an array of records');
      }
      
      console.log(`Received ${jsonData.length} records from SOC API`);
      
      // Process the data based on the type
      let processResult;
      
      switch (options.type) {
        case 'company':
          processResult = await processCompanyData(supabase, jsonData, session.user.id);
          break;
        case 'employee':
          processResult = await processEmployeeData(supabase, jsonData, session.user.id);
          break;
        case 'absenteeism':
          processResult = await processAbsenteeismData(supabase, jsonData, session.user.id);
          break;
        default:
          throw new Error(`Unsupported data type: ${options.type}`);
      }
      
      // Update the sync log with success
      await supabase
        .from('sync_logs')
        .update({ 
          status: 'success',
          message: `Sincronização de ${options.type} concluída: ${processResult.success} de ${processResult.total} registros processados`,
          completed_at: new Date().toISOString()
        })
        .eq('id', logEntry.id);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Sincronização de ${options.type} concluída com sucesso`, 
          data: processResult 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
      
    } catch (error) {
      console.error(`Error during ${options.type} sync:`, error);
      
      // Update the sync log with error
      await supabase
        .from('sync_logs')
        .update({ 
          status: 'error',
          message: `Falha na sincronização de ${options.type}: ${error.message}`,
          error_details: error.stack,
          completed_at: new Date().toISOString()
        })
        .eq('id', logEntry.id);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Falha na sincronização de ${options.type}`, 
          error: error.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Erro interno no servidor', error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Process company data from SOC API
async function processCompanyData(supabase: any, data: any[], userId: string) {
  let success = 0;
  let failed = 0;
  
  for (const item of data) {
    try {
      // Check if the company already exists in the database
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('soc_code', item.CODIGO)
        .eq('user_id', userId)
        .maybeSingle();
      
      const companyData = {
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
      };
      
      if (existingCompany) {
        // Update existing company
        const { error } = await supabase
          .from('companies')
          .update(companyData)
          .eq('id', existingCompany.id);
          
        if (error) {
          console.error(`Error updating company ${item.CODIGO}:`, error);
          failed++;
        } else {
          success++;
        }
      } else {
        // Insert new company
        const { error } = await supabase
          .from('companies')
          .insert(companyData);
          
        if (error) {
          console.error(`Error inserting company ${item.CODIGO}:`, error);
          failed++;
        } else {
          success++;
        }
      }
    } catch (error) {
      console.error(`Error processing company ${item.CODIGO}:`, error);
      failed++;
    }
  }
  
  return {
    total: data.length,
    success,
    failed
  };
}

// Process employee data from SOC API
async function processEmployeeData(supabase: any, data: any[], userId: string) {
  let success = 0;
  let failed = 0;
  
  console.log(`Processing ${data.length} employee records`);
  
  for (const item of data) {
    try {
      // Find company by SOC code
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('soc_code', item.CODIGOEMPRESA)
        .eq('user_id', userId)
        .maybeSingle();
      
      // If company not found, let's create a placeholder one
      let companyId;
      
      if (!company) {
        console.log(`Company with SOC code ${item.CODIGOEMPRESA} not found, creating placeholder...`);
        
        // Create a placeholder company
        const { data: newCompany, error: companyError } = await supabase
          .from('companies')
          .insert({
            soc_code: item.CODIGOEMPRESA,
            short_name: item.NOMEEMPRESA || 'Empresa sem nome',
            corporate_name: item.NOMEEMPRESA || 'Empresa sem nome',
            user_id: userId
          })
          .select('id')
          .single();
          
        if (companyError) {
          console.error(`Error creating placeholder company for ${item.CODIGOEMPRESA}:`, companyError);
          failed++;
          continue;
        }
        
        companyId = newCompany.id;
      } else {
        companyId = company.id;
      }
      
      // Check if the employee already exists
      const { data: existingEmployee } = await supabase
        .from('employees')
        .select('id')
        .eq('soc_code', item.CODIGO)
        .eq('company_soc_code', item.CODIGOEMPRESA)
        .eq('user_id', userId)
        .maybeSingle();
      
      const employeeData = {
        soc_code: item.CODIGO,
        company_id: companyId,
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
        last_update_date: item.DATAULTALTERACAO ? new Date(item.DATAULTALTERACAO) : null,
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
      };
      
      if (existingEmployee) {
        // Update existing employee
        const { error } = await supabase
          .from('employees')
          .update(employeeData)
          .eq('id', existingEmployee.id);
          
        if (error) {
          console.error(`Error updating employee ${item.CODIGO}:`, error);
          failed++;
        } else {
          success++;
        }
      } else {
        // Insert new employee
        const { error } = await supabase
          .from('employees')
          .insert(employeeData);
          
        if (error) {
          console.error(`Error inserting employee ${item.CODIGO}:`, error);
          failed++;
        } else {
          success++;
        }
      }
    } catch (error) {
      console.error(`Error processing employee ${item.CODIGO}:`, error);
      failed++;
    }
  }
  
  return {
    total: data.length,
    success,
    failed
  };
}

// Process absenteeism data from SOC API
async function processAbsenteeismData(supabase: any, data: any[], userId: string) {
  let success = 0;
  let failed = 0;
  
  for (const item of data) {
    try {
      // Try to find the employee by registration number
      let employeeId = null;
      
      if (item.MATRICULA_FUNC) {
        const { data: employee } = await supabase
          .from('employees')
          .select('id')
          .eq('employee_registration', item.MATRICULA_FUNC)
          .eq('user_id', userId)
          .maybeSingle();
          
        if (employee) {
          employeeId = employee.id;
        }
      }
      
      // Try to find the company (first company associated with the user)
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .single();
        
      if (!company) {
        console.warn(`No company found for absenteeism record with employee registration ${item.MATRICULA_FUNC}`);
        failed++;
        continue;
      }
      
      // For absenteeism, we insert a new record each time (not update)
      // as these are events that can repeat
      const absenteeismData = {
        unit: item.UNIDADE,
        sector: item.SETOR,
        employee_registration: item.MATRICULA_FUNC,
        employee_id: employeeId,
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
        company_id: company.id,
        user_id: userId
      };
      
      const { error } = await supabase
        .from('absenteeism')
        .insert(absenteeismData);
        
      if (error) {
        console.error(`Error inserting absenteeism record:`, error);
        failed++;
      } else {
        success++;
      }
    } catch (error) {
      console.error(`Error processing absenteeism record:`, error);
      failed++;
    }
  }
  
  return {
    total: data.length,
    success,
    failed
  };
}
