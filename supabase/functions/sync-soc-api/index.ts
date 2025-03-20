
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
        
        console.log("API Response (sample):", decodedContent.substring(0, 200) + "...");
        
        // Parse the JSON response
        let jsonData;
        try {
          jsonData = JSON.parse(decodedContent);
          console.log("JSON parsed successfully. First record sample:", JSON.stringify(jsonData[0]).substring(0, 200) + "...");
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
        
        // Process in smaller batches to avoid request size issues
        const BATCH_SIZE = 20; // Reduced batch size
        let processedCount = 0;
        let successCount = 0;
        let errorCount = 0;
        let totalBatches = Math.ceil(jsonData.length / BATCH_SIZE);
        
        console.log(`Processing ${jsonData.length} records in ${totalBatches} batches of ${BATCH_SIZE}`);
        
        for (let i = 0; i < jsonData.length; i += BATCH_SIZE) {
          const batchData = jsonData.slice(i, i + BATCH_SIZE);
          const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
          
          console.log(`Processing batch ${batchNumber}/${totalBatches} with ${batchData.length} records`);
          
          try {
            let result;
            if (type === 'employee') {
              result = await processEmployeeBatch(supabaseAdmin, batchData, userId);
              successCount += result.success || 0;
              errorCount += result.error || 0;
            } else if (type === 'absenteeism') {
              result = await processAbsenteeismBatch(supabaseAdmin, batchData, userId);
              successCount += result.success || 0;
              errorCount += result.error || 0;
            }
            
            processedCount += batchData.length;
            
            // Update sync log with progress
            await supabaseAdmin
              .from('sync_logs')
              .update({
                message: `Processed ${processedCount} of ${jsonData.length} ${type} records (${Math.round((processedCount / jsonData.length) * 100)}%). Success: ${successCount}, Errors: ${errorCount}`
              })
              .eq('id', syncId);
              
            console.log(`Batch ${batchNumber} processed. Success: ${result.success || 0}, Errors: ${result.error || 0}. Total progress: ${processedCount}/${jsonData.length}`);
            
          } catch (batchError) {
            console.error(`Error processing batch ${batchNumber}:`, batchError);
            errorCount += batchData.length;
            // Continue with next batch even if one fails
          }
          
          // Small delay between batches to avoid overload
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Update sync log with completion status
        await supabaseAdmin
          .from('sync_logs')
          .update({
            status: 'completed',
            message: `Synchronization completed: ${successCount} of ${jsonData.length} ${type} records processed successfully. Errors: ${errorCount}`,
            completed_at: new Date().toISOString()
          })
          .eq('id', syncId);
        
        console.log(`Sync ID ${syncId} for ${type} completed successfully. Success: ${successCount}, Errors: ${errorCount}`);
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

// Function to process employee batches
async function processEmployeeBatch(supabase, data, userId) {
  console.log(`Processing batch of ${data.length} employee records`);
  let success = 0;
  let error = 0;
  
  // Process each employee individually to better track errors
  for (const item of data) {
    try {
      // First check if this employee already exists by soc_code and user_id
      const { data: existingEmployee } = await supabase
        .from('employees')
        .select('id')
        .eq('soc_code', item.CODIGO)
        .eq('user_id', userId)
        .maybeSingle();

      const employeeData = {
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
        gender: typeof item.SEXO === 'number' ? item.SEXO : null,
        pis: item.PIS,
        work_card: item.CTPS,
        work_card_series: item.SERIECTPS,
        marital_status: typeof item.ESTADOCIVIL === 'number' ? item.ESTADOCIVIL : null,
        contract_type: typeof item.TIPOCONTATACAO === 'number' ? item.TIPOCONTATACAO : null,
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
        skin_color: typeof item.COR === 'number' && item.COR <= 32767 ? item.COR : null,
        education: typeof item.ESCOLARIDADE === 'number' && item.ESCOLARIDADE <= 32767 ? item.ESCOLARIDADE : null,
        birthplace: item.NATURALIDADE,
        extension: item.RAMAL,
        shift_regime: typeof item.REGIMEREVEZAMENTO === 'number' && item.REGIMEREVEZAMENTO <= 32767 ? item.REGIMEREVEZAMENTO : null,
        work_regime: item.REGIMETRABALHO,
        commercial_phone: item.TELCOMERCIAL,
        work_shift: typeof item.TURNOTRABALHO === 'number' && item.TURNOTRABALHO <= 32767 ? item.TURNOTRABALHO : null,
        hr_unit: item.RHUNIDADE,
        hr_sector: item.RHSETOR,
        hr_position: item.RHCARGO,
        hr_cost_center_unit: item.RHCENTROCUSTOUNIDADE,
        user_id: userId
      };

      // Check for and handle company relationship
      try {
        // Look for existing company or create one if needed
        const { data: existingCompany } = await supabase
          .from('companies')
          .select('id')
          .eq('soc_code', item.CODIGOEMPRESA)
          .eq('user_id', userId)
          .maybeSingle();
          
        if (!existingCompany) {
          // Create a placeholder company if needed
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
            
          if (!companyError && newCompany) {
            employeeData.company_id = newCompany.id;
          }
        } else {
          employeeData.company_id = existingCompany.id;
        }
      } catch (companyError) {
        console.error(`Error handling company for employee ${item.CODIGO}:`, companyError);
      }
      
      let result;
      if (existingEmployee) {
        // Update existing employee
        result = await supabase
          .from('employees')
          .update(employeeData)
          .eq('id', existingEmployee.id);
      } else {
        // Insert new employee
        result = await supabase
          .from('employees')
          .insert(employeeData);
      }
      
      if (result.error) {
        console.error(`Error processing employee ${item.CODIGO}:`, result.error);
        error++;
      } else {
        success++;
      }
    } catch (individualError) {
      console.error(`Error processing individual employee ${item?.CODIGO || 'unknown'}:`, individualError);
      error++;
    }
  }
  
  return { count: data.length, success, error };
}

// Function to process absenteeism batches - Updated to use insert instead of upsert
async function processAbsenteeismBatch(supabase, data, userId) {
  console.log(`Processing batch of ${data.length} absenteeism records`);
  let success = 0;
  let error = 0;
  
  // Process each absenteeism record individually
  for (const item of data) {
    try {
      let employeeId = null;
      
      // Try to find the employee by registration number
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
      
      // Ensure genders, certificate_type don't exceed smallint range
      const gender = typeof item.SEXO === 'number' && item.SEXO <= 32767 ? item.SEXO : null;
      const certificateType = typeof item.TIPO_ATESTADO === 'number' && item.TIPO_ATESTADO <= 32767 ? item.TIPO_ATESTADO : null;
      
      const absenteeismData = {
        unit: item.UNIDADE,
        sector: item.SETOR,
        employee_registration: item.MATRICULA_FUNC,
        employee_id: employeeId,
        birth_date: item.DT_NASCIMENTO ? new Date(item.DT_NASCIMENTO) : null,
        gender: gender,
        certificate_type: certificateType,
        start_date: item.DT_INICIO_ATESTADO ? new Date(item.DT_INICIO_ATESTADO) : new Date(),
        end_date: item.DT_FIM_ATESTADO ? new Date(item.DT_FIM_ATESTADO) : new Date(),
        start_time: item.HORA_INICIO_ATESTADO,
        end_time: item.HORA_FIM_ATESTADO,
        days_absent: typeof item.DIAS_AFASTADOS === 'number' ? item.DIAS_AFASTADOS : null,
        hours_absent: item.HORAS_AFASTADO,
        primary_icd: item.CID_PRINCIPAL,
        icd_description: item.DESCRICAO_CID,
        pathological_group: item.GRUPO_PATOLOGICO,
        license_type: item.TIPO_LICENCA,
        user_id: userId
      };
      
      // Always use insert for absenteeism records
      const { error: insertError } = await supabase
        .from('absenteeism')
        .insert(absenteeismData);
        
      if (insertError) {
        console.error(`Error inserting absenteeism record:`, insertError);
        error++;
      } else {
        success++;
      }
    } catch (individualError) {
      console.error(`Error processing individual absenteeism record:`, individualError);
      error++;
    }
  }
  
  return { count: data.length, success, error };
}
