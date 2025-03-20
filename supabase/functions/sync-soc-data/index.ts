
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SOC_API_URL = 'https://ws1.soc.com.br/WebSoc/exportadados';

interface SyncOptions {
  type: 'company' | 'employee' | 'absenteeism';
  params?: Record<string, string>;
  parallel?: boolean;
  batchSize?: number;
  maxConcurrent?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    // Debug request headers
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    console.log('Sync-SOC-Data - Request headers:', JSON.stringify(headers));
    
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Missing authorization header',
          headers
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Extract token (remove Bearer prefix if it exists)
    const token = authHeader.replace('Bearer ', '');
    
    // Log token details (first and last few characters, for security)
    const tokenLength = token.length;
    const maskedToken = tokenLength > 10 ? 
      `${token.substring(0, 5)}...${token.substring(tokenLength - 5)}` : 
      'token too short';
    console.log(`Token received (masked): ${maskedToken}, length: ${tokenLength}`);
    
    // Create admin client to verify the token
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // Get user with service role to verify the token
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Error verifying token:', userError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Not authenticated',
          error: userError ? userError.message : 'No user found for token'
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log(`Authenticated as user: ${user.email} (${user.id})`);
    
    // Initialize regular Supabase client for data operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });
    
    // Parse the request body
    const options: SyncOptions = await req.json();
    
    if (!options || !options.type) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid request: missing type' }),
        { 
          status: 400, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log(`Syncing ${options.type} data with options:`, JSON.stringify(options));
    
    // Create a sync log entry
    const { data: logEntry, error: logError } = await supabase
      .from('sync_logs')
      .insert({
        type: options.type,
        status: 'pending',
        message: `Sincronização de ${options.type} iniciada`,
        user_id: user.id
      })
      .select()
      .single();
    
    if (logError) {
      console.error('Error creating sync log:', logError);
      return new Response(
        JSON.stringify({ success: false, message: 'Falha ao criar registro de sincronização' }),
        { 
          status: 500, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Update log to in-progress
    await supabase
      .from('sync_logs')
      .update({ 
        status: 'in_progress',
        message: `Sincronização de ${options.type} em andamento`,
        started_at: new Date().toISOString()
      })
      .eq('id', logEntry.id);
    
    // Return success early while the sync continues in the background
    // This ensures the client gets a response quickly
    const response = new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sincronização de ${options.type} iniciada com sucesso`, 
        syncId: logEntry.id,
        user: {
          id: user.id,
          email: user.email
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
    
    // Process the sync in background using EdgeRuntime.waitUntil
    const processingPromise = processSyncInBackground(supabase, options, logEntry.id, user.id);
    //@ts-ignore - EdgeRuntime is available in Deno Deploy
    EdgeRuntime.waitUntil(processingPromise);
    
    return response;
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Erro interno no servidor', 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Process the sync in background
async function processSyncInBackground(supabase, options: SyncOptions, syncId: number, userId: string) {
  try {
    console.log(`Starting background sync process for ${options.type} with sync ID ${syncId}`);
    
    // Load API config from database
    const { data: apiConfig, error: configError } = await supabase
      .from('api_credentials')
      .select('*')
      .eq('type', options.type)
      .eq('user_id', userId)
      .single();
    
    if (configError || !apiConfig) {
      console.error(`Error loading API config for ${options.type}:`, configError);
      await updateSyncLog(supabase, syncId, 'error', `Falha ao carregar configuração da API: ${configError?.message || 'Configuração não encontrada'}`);
      return;
    }
    
    console.log(`Loaded API config for ${options.type}`);
    
    // Format request parameters for SOC API
    const params = { ...apiConfig };
    // Remove unnecessary fields
    delete params.id;
    delete params.created_at;
    delete params.updated_at; 
    delete params.user_id;
    delete params.isConfigured;
    
    // Make sure tipoSaida is set to json
    params.tipoSaida = 'json';
    
    const formattedParams = JSON.stringify(params);
    const apiUrl = `${SOC_API_URL}?parametro=${encodeURIComponent(formattedParams)}`;
    
    console.log(`Calling SOC API at: ${apiUrl}`);
    
    // Update log with API call starting
    await updateSyncLog(supabase, syncId, 'processing', `Chamando API SOC para ${options.type}`);
    
    // Make the API request with timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
    
    try {
      const response = await fetch(apiUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`API request failed with status: ${response.status}`);
      }
      
      // Get the text response and decode it from latin-1
      const textResponse = await response.text();
      const decodedResponse = new TextDecoder('latin1').decode(new TextEncoder().encode(textResponse));
      
      // Parse the JSON response
      let jsonData;
      try {
        jsonData = JSON.parse(decodedResponse);
      } catch (parseError) {
        console.error('Error parsing JSON response:', parseError);
        await updateSyncLog(
          supabase, 
          syncId, 
          'error', 
          `Erro ao processar resposta da API: ${parseError.message}`,
          null,
          decodedResponse.substring(0, 1000) // Include first 1000 chars of response for debugging
        );
        return;
      }
      
      if (!Array.isArray(jsonData)) {
        console.error('API did not return an array of records:', typeof jsonData);
        await updateSyncLog(
          supabase, 
          syncId, 
          'error', 
          `API não retornou um array de registros: ${typeof jsonData}`,
          null,
          JSON.stringify(jsonData).substring(0, 1000)
        );
        return;
      }
      
      console.log(`Received ${jsonData.length} records from SOC API`);
      
      // Update log with total records count
      await supabase
        .from('sync_logs')
        .update({ 
          total_records: jsonData.length,
          processed_records: 0
        })
        .eq('id', syncId);
      
      // Process the data based on the type
      let processResult;
      
      switch (options.type) {
        case 'company':
          processResult = await processCompanyData(supabase, jsonData, userId, syncId);
          break;
        case 'employee':
          processResult = await processEmployeeData(supabase, jsonData, userId, syncId, options);
          break;
        case 'absenteeism':
          processResult = await processAbsenteeismData(supabase, jsonData, userId, syncId, options);
          break;
        default:
          throw new Error(`Unsupported data type: ${options.type}`);
      }
      
      // Update the sync log with success
      await updateSyncLog(
        supabase,
        syncId,
        'completed',
        `Sincronização de ${options.type} concluída: ${processResult.success} de ${processResult.total} registros processados`
      );
      
      console.log(`Sync ${syncId} completed successfully`);
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error(`Error fetching data from SOC API:`, fetchError);
      
      // Update the sync log with error
      await updateSyncLog(
        supabase,
        syncId,
        'error',
        `Falha na chamada à API SOC: ${fetchError.message}`
      );
    }
    
  } catch (error) {
    console.error(`Error during background sync process:`, error);
    
    // Update the sync log with error
    await supabase
      .from('sync_logs')
      .update({ 
        status: 'error',
        message: `Erro interno na sincronização: ${error.message}`,
        error_details: error.stack,
        completed_at: new Date().toISOString()
      })
      .eq('id', syncId);
  }
}

// Helper to update sync log
async function updateSyncLog(
  supabase, 
  syncId: number, 
  status: string, 
  message: string, 
  error_details: string | null = null,
  additional_info: string | null = null
) {
  const updateData: Record<string, any> = { 
    status, 
    message 
  };
  
  if (status === 'completed' || status === 'error' || status === 'cancelled') {
    updateData.completed_at = new Date().toISOString();
  }
  
  if (error_details) {
    updateData.error_details = error_details;
  }
  
  if (additional_info) {
    updateData.additional_info = additional_info;
  }
  
  const { error } = await supabase
    .from('sync_logs')
    .update(updateData)
    .eq('id', syncId);
    
  if (error) {
    console.error(`Error updating sync log ${syncId}:`, error);
  }
}

// Process company data from SOC API
async function processCompanyData(supabase, data: any[], userId: string, syncId: number) {
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    try {
      // Update progress every 10 items
      if (i % 10 === 0) {
        await supabase
          .from('sync_logs')
          .update({ processed_records: i })
          .eq('id', syncId);
      }
      
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
  
  // Update final progress
  await supabase
    .from('sync_logs')
    .update({ processed_records: data.length })
    .eq('id', syncId);
  
  return {
    total: data.length,
    success,
    failed
  };
}

// Process employee data from SOC API
async function processEmployeeData(
  supabase, 
  data: any[], 
  userId: string, 
  syncId: number,
  options: SyncOptions
) {
  let success = 0;
  let failed = 0;
  
  console.log(`Processing ${data.length} employee records`);
  
  const batchSize = options.batchSize || 100;
  const maxConcurrent = options.maxConcurrent || 5;
  const useParallel = options.parallel === true && data.length > batchSize;
  
  if (useParallel) {
    // Process in parallel batches
    console.log(`Processing employees in parallel: ${maxConcurrent} concurrent batches of ${batchSize}`);
    
    // Split data into batches
    const batches = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }
    
    // Update log with batch information
    await supabase
      .from('sync_logs')
      .update({ 
        total_batches: batches.length,
        batch: 0,
        message: `Processando ${data.length} funcionários em ${batches.length} lotes`
      })
      .eq('id', syncId);
    
    // Process batches in chunks of maxConcurrent
    for (let i = 0; i < batches.length; i += maxConcurrent) {
      const currentBatches = batches.slice(i, i + maxConcurrent);
      const batchPromises = currentBatches.map((batch, index) => 
        processEmployeeBatch(supabase, batch, userId, i + index + 1, batches.length, syncId)
      );
      
      const batchResults = await Promise.all(batchPromises);
      
      // Update progress and sum results
      for (const result of batchResults) {
        success += result.success;
        failed += result.failed;
      }
    }
  } else {
    // Process sequentially
    console.log(`Processing employees sequentially`);
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      try {
        // Update progress every 10 items
        if (i % 10 === 0) {
          await supabase
            .from('sync_logs')
            .update({ 
              processed_records: i,
              message: `Processando registro ${i+1} de ${data.length}`
            })
            .eq('id', syncId);
        }
        
        const result = await processEmployeeItem(supabase, item, userId);
        if (result) {
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Error processing employee ${item.CODIGO}:`, error);
        failed++;
      }
    }
  }
  
  return {
    total: data.length,
    success,
    failed
  };
}

// Process a batch of employees
async function processEmployeeBatch(
  supabase,
  batch: any[],
  userId: string,
  batchNumber: number,
  totalBatches: number,
  syncId: number
) {
  console.log(`Starting batch ${batchNumber}/${totalBatches} with ${batch.length} employees`);
  
  let batchSuccess = 0;
  let batchFailed = 0;
  
  // Update log to show which batch is processing
  await supabase
    .from('sync_logs')
    .update({ 
      batch: batchNumber,
      message: `Processando lote ${batchNumber} de ${totalBatches} (${batch.length} registros)`
    })
    .eq('id', syncId);
  
  for (let i = 0; i < batch.length; i++) {
    try {
      // Update progress within batch every 10 items
      if (i % 10 === 0) {
        const totalProcessed = await getCurrentProcessedCount(supabase, syncId);
        await supabase
          .from('sync_logs')
          .update({ 
            processed_records: totalProcessed + i,
            status: 'processing'
          })
          .eq('id', syncId);
      }
      
      const result = await processEmployeeItem(supabase, batch[i], userId);
      if (result) {
        batchSuccess++;
      } else {
        batchFailed++;
      }
    } catch (error) {
      console.error(`Error processing employee in batch ${batchNumber}:`, error);
      batchFailed++;
    }
  }
  
  // Update processed count after batch
  const totalProcessed = await getCurrentProcessedCount(supabase, syncId);
  await supabase
    .from('sync_logs')
    .update({ 
      processed_records: totalProcessed + batch.length,
      message: `Lote ${batchNumber} de ${totalBatches} concluído`
    })
    .eq('id', syncId);
  
  console.log(`Completed batch ${batchNumber}/${totalBatches}: ${batchSuccess} success, ${batchFailed} failed`);
  
  return {
    success: batchSuccess,
    failed: batchFailed
  };
}

// Get current processed count
async function getCurrentProcessedCount(supabase, syncId: number) {
  const { data } = await supabase
    .from('sync_logs')
    .select('processed_records')
    .eq('id', syncId)
    .single();
  
  return data?.processed_records || 0;
}

// Process a single employee
async function processEmployeeItem(supabase, item: any, userId: string) {
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
        return false;
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
        return false;
      } else {
        console.log(`Successfully updated employee ${item.CODIGO}`);
        return true;
      }
    } else {
      // Insert new employee
      const { error } = await supabase
        .from('employees')
        .insert(employeeData);
        
      if (error) {
        console.error(`Error inserting employee ${item.CODIGO}:`, error);
        return false;
      } else {
        console.log(`Successfully inserted employee ${item.CODIGO}`);
        return true;
      }
    }
  } catch (error) {
    console.error(`Error processing employee ${item?.CODIGO}:`, error);
    return false;
  }
}

// Process absenteeism data from SOC API
async function processAbsenteeismData(
  supabase, 
  data: any[], 
  userId: string, 
  syncId: number,
  options: SyncOptions
) {
  let success = 0;
  let failed = 0;
  
  const batchSize = options.batchSize || 100;
  const maxConcurrent = options.maxConcurrent || 5;
  const useParallel = options.parallel === true && data.length > batchSize;
  
  console.log(`Processing ${data.length} absenteeism records, parallel: ${useParallel}`);
  
  if (useParallel) {
    // Process in parallel batches
    console.log(`Processing absenteeism in parallel: ${maxConcurrent} concurrent batches of ${batchSize}`);
    
    // Split data into batches
    const batches = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }
    
    // Update log with batch information
    await supabase
      .from('sync_logs')
      .update({ 
        total_batches: batches.length,
        batch: 0,
        message: `Processando ${data.length} registros de absenteísmo em ${batches.length} lotes`
      })
      .eq('id', syncId);
    
    // Process batches in chunks of maxConcurrent
    for (let i = 0; i < batches.length; i += maxConcurrent) {
      const currentBatches = batches.slice(i, i + maxConcurrent);
      const batchPromises = currentBatches.map((batch, index) => 
        processAbsenteeismBatch(supabase, batch, userId, i + index + 1, batches.length, syncId)
      );
      
      const batchResults = await Promise.all(batchPromises);
      
      // Update progress and sum results
      for (const result of batchResults) {
        success += result.success;
        failed += result.failed;
      }
    }
  } else {
    // Process sequentially
    for (let i = 0; i < data.length; i++) {
      try {
        // Update progress every 10 items
        if (i % 10 === 0) {
          await supabase
            .from('sync_logs')
            .update({ 
              processed_records: i,
              message: `Processando registro ${i+1} de ${data.length}`
            })
            .eq('id', syncId);
        }
        
        const result = await processAbsenteeismItem(supabase, data[i], userId);
        if (result) {
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Error processing absenteeism record:`, error);
        failed++;
      }
    }
  }
  
  return {
    total: data.length,
    success,
    failed
  };
}

// Process a batch of absenteeism records
async function processAbsenteeismBatch(
  supabase,
  batch: any[],
  userId: string,
  batchNumber: number,
  totalBatches: number,
  syncId: number
) {
  console.log(`Starting absenteeism batch ${batchNumber}/${totalBatches} with ${batch.length} records`);
  
  let batchSuccess = 0;
  let batchFailed = 0;
  
  // Update log to show which batch is processing
  await supabase
    .from('sync_logs')
    .update({ 
      batch: batchNumber,
      message: `Processando lote ${batchNumber} de ${totalBatches} (${batch.length} registros)`
    })
    .eq('id', syncId);
  
  for (let i = 0; i < batch.length; i++) {
    try {
      // Update progress within batch every 10 items
      if (i % 10 === 0) {
        const totalProcessed = await getCurrentProcessedCount(supabase, syncId);
        await supabase
          .from('sync_logs')
          .update({ 
            processed_records: totalProcessed + i,
            status: 'processing'
          })
          .eq('id', syncId);
      }
      
      const result = await processAbsenteeismItem(supabase, batch[i], userId);
      if (result) {
        batchSuccess++;
      } else {
        batchFailed++;
      }
    } catch (error) {
      console.error(`Error processing absenteeism in batch ${batchNumber}:`, error);
      batchFailed++;
    }
  }
  
  // Update processed count after batch
  const totalProcessed = await getCurrentProcessedCount(supabase, syncId);
  await supabase
    .from('sync_logs')
    .update({ 
      processed_records: totalProcessed + batch.length,
      message: `Lote ${batchNumber} de ${totalBatches} concluído`
    })
    .eq('id', syncId);
  
  console.log(`Completed absenteeism batch ${batchNumber}/${totalBatches}: ${batchSuccess} success, ${batchFailed} failed`);
  
  return {
    success: batchSuccess,
    failed: batchFailed
  };
}

// Process a single absenteeism record
async function processAbsenteeismItem(supabase, item: any, userId: string) {
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
      return false;
    }
    
    // For absenteeism, we need to check if a record with the same key data already exists
    const { data: existingRecord } = await supabase
      .from('absenteeism')
      .select('id')
      .eq('employee_registration', item.MATRICULA_FUNC)
      .eq('start_date', item.DT_INICIO_ATESTADO)
      .eq('primary_icd', item.CID_PRINCIPAL)
      .eq('user_id', userId)
      .maybeSingle();
      
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
    
    if (existingRecord) {
      // Update existing record
      const { error } = await supabase
        .from('absenteeism')
        .update(absenteeismData)
        .eq('id', existingRecord.id);
        
      if (error) {
        console.error(`Error updating absenteeism record:`, error);
        return false;
      }
    } else {
      // Insert new record
      const { error } = await supabase
        .from('absenteeism')
        .insert(absenteeismData);
        
      if (error) {
        console.error(`Error inserting absenteeism record:`, error);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error(`Error processing absenteeism record:`, error);
    return false;
  }
}
