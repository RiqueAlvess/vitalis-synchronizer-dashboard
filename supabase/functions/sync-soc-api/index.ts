
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SOC_API_URL = 'https://ws1.soc.com.br/WebSoc/exportadados';

// Smaller batch size for more reliable processing with extensive logging
const BATCH_SIZE = 15;
// Maximum time to run before refreshing the function (in milliseconds)
const MAX_EXECUTION_TIME = 50 * 1000; // 50 seconds to be safe with edge function limits
// Delay between processing batches to avoid overloading the DB
const BATCH_DELAY_MS = 300;
// Maximum retries for operations
const MAX_RETRIES = 3;
// Delay between retries (in milliseconds)
const RETRY_DELAY_MS = 1000;

// Helper function for retries with exponential backoff
async function withRetry<T>(
  operation: () => Promise<T>,
  description: string,
  maxRetries = MAX_RETRIES,
  initialDelay = RETRY_DELAY_MS
): Promise<T> {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`Attempt ${attempt + 1}/${maxRetries} for ${description} failed: ${error.message}`);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error(`All ${maxRetries} attempts for ${description} failed. Last error: ${lastError?.message}`);
}

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

    console.log("Synchronization request received");

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
    let { type, params, continuationData } = requestData;

    // Check if this is a continuation of a previous sync
    let continuationMode = false;
    let processedSoFar = 0;
    let totalRecords = 0;
    let syncId;
    let parentSyncId = null;
    let records = [];
    let batchNumber = 0;
    let totalBatches = 0;
    let maxFailures = 3; // Máximo de falhas consecutivas permitidas antes de abortar

    if (continuationData) {
      console.log("Continuing previous sync task");
      continuationMode = true;
      records = continuationData.records || [];
      processedSoFar = continuationData.processedSoFar || 0;
      totalRecords = continuationData.totalRecords || records.length;
      syncId = continuationData.syncId;
      parentSyncId = continuationData.parentSyncId || null;
      batchNumber = continuationData.batchNumber || 0;
      totalBatches = continuationData.totalBatches || Math.ceil(totalRecords / BATCH_SIZE);
      
      console.log(`Continuing from record ${processedSoFar}/${totalRecords} (batch ${batchNumber}/${totalBatches})`);
    } else {
      if (!type || !params) {
        return new Response(
          JSON.stringify({ success: false, message: 'Missing required parameters: type and params' }),
          { status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
        );
      }

      // Validate type - only allow employee and absenteeism
      if (type !== 'employee' && type !== 'absenteeism' && type !== 'company') {
        return new Response(
          JSON.stringify({ success: false, message: 'Invalid type. Only "employee", "company" and "absenteeism" are supported.' }),
          { status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
        );
      }

      console.log(`New sync request for type ${type} with params:`, params);
    }

    // If this is not a continuation, create a new sync log entry
    if (!continuationMode) {
      const { data: syncLog, error: syncLogError } = await supabaseAdmin
        .from('sync_logs')
        .insert({
          type,
          status: 'started',
          message: `Iniciando sincronização de ${type}`,
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
      syncId = syncLog.id;
    }

    // Update sync log status to processing (if not a continuation)
    if (!continuationMode) {
      await supabaseAdmin
        .from('sync_logs')
        .update({
          status: 'processing',
          message: `Processando dados de ${type} da API SOC`
        })
        .eq('id', syncId);
    }

    // Start the background task
    const userId = user.id;
    
    // Prepare response that will be sent immediately
    const immediateResponse = {
      success: true,
      message: `Synchronization job for ${type} started successfully`,
      syncId: syncId
    };
    
    // Run the heavy processing in the background with waitUntil
    EdgeRuntime.waitUntil((async () => {
      try {
        console.log(`Processing ${type} data in background for sync ID ${syncId}`);
        const startTime = Date.now();
        
        if (!continuationMode) {
          // Only fetch from API if this is a new sync, not a continuation
          console.log("Formatting parameters for SOC API");
          const formattedParams = JSON.stringify(params);
          const apiUrl = `${SOC_API_URL}?parametro=${encodeURIComponent(formattedParams)}`;
          
          console.log('Calling SOC API at:', apiUrl);
          
          try {
            // Make the API request with explicit timeout and retry logic
            const response = await withRetry(
              async () => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 60000); // 1-minute timeout
                
                try {
                  const response = await fetch(apiUrl, {
                    headers: {
                      'Accept': 'application/json',
                      'Accept-Encoding': 'identity' // Request uncompressed response
                    },
                    signal: controller.signal
                  });
                  
                  clearTimeout(timeoutId);
                  
                  if (!response.ok) {
                    throw new Error(`API request failed with status: ${response.status}`);
                  }
                  
                  return response;
                } catch (error) {
                  clearTimeout(timeoutId);
                  throw error;
                }
              },
              "SOC API request"
            );
            
            console.log("API Response received, getting content...");
            
            // Get the text response and decode it from latin-1
            const responseBuffer = await response.arrayBuffer();
            const decoder = new TextDecoder('latin1');
            const decodedContent = decoder.decode(responseBuffer);
            
            console.log(`API Response decoded, length: ${decodedContent.length} characters`);
            
            // Parse the JSON response
            try {
              console.log("Attempting to parse JSON response...");
              records = JSON.parse(decodedContent);
              console.log(`JSON parsed successfully. Record count: ${records.length}`);
            } catch (e) {
              console.error('Error parsing JSON:', e);
              // Try to clean the JSON string before parsing
              try {
                console.log("Cleaning JSON and attempting to parse again...");
                const cleanedJson = decodedContent.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
                records = JSON.parse(cleanedJson);
                console.log(`JSON parsed after cleaning. Record count: ${records.length}`);
              } catch (cleanError) {
                console.error('JSON cleaning failed:', cleanError);
                // Try an even more aggressive approach to parse the response
                try {
                  console.log("Attempting more aggressive JSON parsing...");
                  const jsonStr = decodedContent.trim();
                  // Ensure we have array brackets at the start and end
                  const hasStartBracket = jsonStr.startsWith('[');
                  const hasEndBracket = jsonStr.endsWith(']');
                  
                  let processedJson = jsonStr;
                  if (!hasStartBracket) processedJson = '[' + processedJson;
                  if (!hasEndBracket) processedJson = processedJson + ']';
                  
                  records = JSON.parse(processedJson);
                  console.log(`JSON parsed with manual fixes. Record count: ${records.length}`);
                } catch (finalError) {
                  console.error('All JSON parsing attempts failed:', finalError);
                  
                  // Atualizar log de sincronização com erro
                  await supabaseAdmin
                    .from('sync_logs')
                    .update({
                      status: 'error',
                      message: `Erro ao processar resposta da API: ${e.message}`,
                      error_details: e.stack,
                      completed_at: new Date().toISOString()
                    })
                    .eq('id', syncId);
                    
                  throw new Error(`Invalid JSON response: ${e.message}`);
                }
              }
            }
          } catch (fetchError) {
            console.error('Fetch error:', fetchError);
            
            // Atualizar log de sincronização com erro
            await supabaseAdmin
              .from('sync_logs')
              .update({
                status: 'error',
                message: `Erro na comunicação com a API SOC: ${fetchError.message}`,
                error_details: fetchError.stack,
                completed_at: new Date().toISOString()
              })
              .eq('id', syncId);
              
            throw fetchError;
          }
          
          if (!Array.isArray(records)) {
            console.error('API response is not an array:', typeof records);
            
            // Atualizar log de sincronização com erro
            await supabaseAdmin
              .from('sync_logs')
              .update({
                status: 'error',
                message: 'API não retornou um array de registros',
                completed_at: new Date().toISOString()
              })
              .eq('id', syncId);
              
            throw new Error('API did not return an array of records');
          }
          
          console.log(`Received ${records.length} records from SOC API for ${type}`);
          totalRecords = records.length;
          totalBatches = Math.ceil(totalRecords / BATCH_SIZE);
          
          // Update sync log with total count
          await supabaseAdmin
            .from('sync_logs')
            .update({
              message: `Processando ${records.length} registros de ${type}`,
              total_batches: totalBatches
            })
            .eq('id', syncId);
        }
        
        // Process in batches
        let processedCount = processedSoFar;
        let successCount = 0;
        let errorCount = 0;
        let consecutiveFailures = 0;
        
        console.log(`Processing ${totalRecords - processedSoFar} remaining records in ${totalBatches} batches of ${BATCH_SIZE}`);
        
        for (let i = processedSoFar; i < totalRecords; i += BATCH_SIZE) {
          const currentBatchStart = Date.now();
          batchNumber++;
          
          // Check if we're approaching the max execution time
          const elapsedTime = Date.now() - startTime;
          if (elapsedTime > MAX_EXECUTION_TIME) {
            console.log(`Approaching max execution time after processing ${processedCount - processedSoFar} records (${elapsedTime}ms elapsed)`);
            
            // Create a new sync log entry for continuation
            const { data: continuationLog } = await supabaseAdmin
              .from('sync_logs')
              .insert({
                type,
                status: 'processing',
                message: `Continuando lote ${batchNumber}/${totalBatches}. Processados ${processedCount} de ${totalRecords} registros (${Math.round((processedCount / totalRecords) * 100)}%).`,
                user_id: userId,
                started_at: new Date().toISOString(),
                parent_id: parentSyncId || syncId, // Use o ID principal para manter o rastreamento
                batch: batchNumber,
                total_batches: totalBatches
              })
              .select()
              .single();
              
            if (continuationLog) {
              console.log(`Created continuation log with ID ${continuationLog.id}`);
              
              // Update current log with partial completion
              await supabaseAdmin
                .from('sync_logs')
                .update({
                  status: 'continues',
                  message: `Processado parcialmente: ${processedCount} de ${totalRecords} registros (${Math.round((processedCount / totalRecords) * 100)}%). Continuando no lote ${batchNumber}.`,
                  completed_at: new Date().toISOString()
                })
                .eq('id', syncId);
                
              // Remaining records to process
              const remainingRecords = records.slice(i);
              
              // Call the same endpoint to continue processing
              try {
                console.log(`Sending continuation request with ${remainingRecords.length} remaining records`);
                const continuationResponse = await fetch(`${SUPABASE_URL}/functions/v1/sync-soc-api`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    type,
                    params,
                    continuationData: {
                      records: remainingRecords,
                      processedSoFar: processedCount,
                      totalRecords,
                      syncId: continuationLog.id,
                      parentSyncId: parentSyncId || syncId, // Mantém o rastreamento do ID principal
                      batchNumber,
                      totalBatches
                    }
                  })
                });
                
                if (!continuationResponse.ok) {
                  console.error(`Continuation request failed with status: ${continuationResponse.status}`);
                  const responseText = await continuationResponse.text();
                  console.error(`Response: ${responseText}`);
                  
                  // Update the log with the failure but don't fail the whole process
                  await supabaseAdmin
                    .from('sync_logs')
                    .update({
                      status: 'error',
                      message: `Falha ao criar processo de continuação: ${continuationResponse.status} - ${responseText}`,
                      completed_at: new Date().toISOString()
                    })
                    .eq('id', continuationLog.id);
                  
                } else {
                  console.log(`Continuation request sent successfully, ending current process`);
                }
                
                return; // End current process after sending continuation
              } catch (continuationError) {
                console.error(`Error sending continuation request:`, continuationError);
                
                // Update the log with the error
                await supabaseAdmin
                  .from('sync_logs')
                  .update({
                    status: 'error',
                    message: `Erro ao criar processo de continuação: ${continuationError.message}`,
                    completed_at: new Date().toISOString()
                  })
                  .eq('id', continuationLog.id);
                
                // Continue with current process if continuation fails
              }
            }
          }
          
          const batchData = records.slice(i, i + BATCH_SIZE);
          
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
            } else if (type === 'company') {
              result = await processCompanyBatch(supabaseAdmin, batchData, userId);
              successCount += result.success || 0;
              errorCount += result.error || 0;
            }
            
            processedCount += batchData.length;
            consecutiveFailures = 0; // Reseta contagem de falhas consecutivas após sucesso
            
            // Update sync log with progress
            await supabaseAdmin
              .from('sync_logs')
              .update({
                message: `Lote ${batchNumber}/${totalBatches}: Processados ${processedCount} de ${totalRecords} registros (${Math.round((processedCount / totalRecords) * 100)}%). Sucesso: ${successCount}, Erros: ${errorCount}`,
                batch: batchNumber,
                total_batches: totalBatches
              })
              .eq('id', syncId);
              
            console.log(`Batch ${batchNumber} processed in ${Date.now() - currentBatchStart}ms. Success: ${result.success || 0}, Errors: ${result.error || 0}`);
            console.log(`Total progress: ${processedCount}/${totalRecords} (${Math.round((processedCount / totalRecords) * 100)}%)`);
            
            // Add delay between batches to avoid overloading the DB
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
            
          } catch (batchError) {
            console.error(`Error processing batch ${batchNumber}:`, batchError);
            errorCount += batchData.length;
            consecutiveFailures++;
            
            // Verificar se atingimos o número máximo de falhas consecutivas
            if (consecutiveFailures >= maxFailures) {
              console.error(`Maximum consecutive failures (${maxFailures}) reached. Stopping process.`);
              
              // Atualizar log com erro fatal
              await supabaseAdmin
                .from('sync_logs')
                .update({
                  status: 'error',
                  message: `Erro crítico: ${consecutiveFailures} falhas consecutivas. Processo interrompido. Último erro: ${batchError.message}`,
                  error_details: batchError.stack,
                  completed_at: new Date().toISOString()
                })
                .eq('id', syncId);
                
              throw new Error(`Maximum failures reached: ${batchError.message}`);
            }
            
            // Continue with next batch even if one fails (até o limite máximo)
            await supabaseAdmin
              .from('sync_logs')
              .update({
                message: `Erro no lote ${batchNumber}/${totalBatches}: ${batchError.message}. Tentando próximo lote.`
              })
              .eq('id', syncId);
              
            // Adiciona um atraso maior após falha para permitir que o sistema se recupere
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS * 3));
          }
        }
        
        // Update sync log with completion status
        await supabaseAdmin
          .from('sync_logs')
          .update({
            status: 'completed',
            message: `Sincronização concluída: ${successCount} de ${totalRecords} registros processados com sucesso. Erros: ${errorCount}`,
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
            message: `Erro: ${error.message}`,
            error_details: error.stack,
            completed_at: new Date().toISOString()
          })
          .eq('id', syncId);
      }
    })());

    // Return immediate success response
    return new Response(
      JSON.stringify(immediateResponse),
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

// Function to process company batches with improved error handling and retries
async function processCompanyBatch(supabase, data, userId) {
  console.log(`Processing batch of ${data.length} company records`);
  let success = 0;
  let error = 0;

  // Process each company record individually with retry logic
  for (const item of data) {
    try {
      // Basic validation
      if (!item.CODIGO) {
        console.warn(`Skipping invalid company record without CODIGO`);
        error++;
        continue;
      }

      const companyData = {
        soc_code: item.CODIGO.toString(),
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

      // Usar withRetry para processamento confiável
      await withRetry(
        async () => {
          // Try to find if this company already exists
          const { data: existingCompany } = await supabase
            .from('companies')
            .select('id')
            .eq('soc_code', item.CODIGO)
            .eq('user_id', userId)
            .maybeSingle();

          let result;
          if (existingCompany) {
            // Update existing company
            result = await supabase
              .from('companies')
              .update(companyData)
              .eq('id', existingCompany.id);
          } else {
            // Insert new company
            result = await supabase
              .from('companies')
              .insert(companyData);
          }

          if (result.error) {
            throw result.error;
          }
        },
        `company ${item.CODIGO}`
      );
      
      success++;
    } catch (individualError) {
      console.error(`Error processing individual company ${item?.CODIGO || 'unknown'}:`, individualError);
      error++;
    }
  }

  return { count: data.length, success, error };
}

// Function to process employee batches with improved error handling and retries
async function processEmployeeBatch(supabase, data, userId) {
  console.log(`Processing batch of ${data.length} employee records`);
  let success = 0;
  let error = 0;
  
  // Process each employee individually with retry logic
  for (const item of data) {
    try {
      // Basic validation
      if (!item.CODIGO || !item.NOME) {
        console.warn(`Skipping invalid employee record without CODIGO or NOME:`, 
          JSON.stringify({codigo: item.CODIGO, nome: item.NOME || 'undefined'}));
        error++;
        continue;
      }
      
      console.log(`Processing employee: ${item.CODIGO} - ${item.NOME}`);
      
      // Usar withRetry para processamento confiável
      await withRetry(
        async () => {
          // Find company by SOC code
          let companyId = null;
          if (item.CODIGOEMPRESA) {
            const { data: company } = await supabase
              .from('companies')
              .select('id')
              .eq('soc_code', item.CODIGOEMPRESA)
              .eq('user_id', userId)
              .maybeSingle();
              
            if (company) {
              companyId = company.id;
            }
          }
          
          // If company not found, create a placeholder one
          if (!companyId) {
            console.log(`Company with SOC code ${item.CODIGOEMPRESA} not found, creating placeholder...`);
            
            // Create a placeholder company
            const { data: newCompany, error: companyError } = await supabase
              .from('companies')
              .insert({
                soc_code: item.CODIGOEMPRESA || 'unknown',
                short_name: item.NOMEEMPRESA || 'Empresa sem nome',
                corporate_name: item.NOMEEMPRESA || 'Empresa sem nome',
                user_id: userId
              })
              .select('id')
              .single();
              
            if (companyError) {
              console.error(`Error creating placeholder company for ${item.CODIGOEMPRESA}:`, companyError);
              // Continue without company reference
            } else if (newCompany) {
              companyId = newCompany.id;
            }
          }

          // For numeric fields, ensure they don't exceed smallint range
          const gender = typeof item.SEXO === 'number' && item.SEXO <= 32767 ? item.SEXO : null;
          const maritalStatus = typeof item.ESTADOCIVIL === 'number' && item.ESTADOCIVIL <= 32767 ? item.ESTADOCIVIL : null;
          const contractType = typeof item.TIPOCONTATACAO === 'number' && item.TIPOCONTATACAO <= 32767 ? item.TIPOCONTATACAO : null;
          const skinColor = typeof item.COR === 'number' && item.COR <= 32767 ? item.COR : null;
          const education = typeof item.ESCOLARIDADE === 'number' && item.ESCOLARIDADE <= 32767 ? item.ESCOLARIDADE : null;
          const shiftRegime = typeof item.REGIMEREVEZAMENTO === 'number' && item.REGIMEREVEZAMENTO <= 32767 ? item.REGIMEREVEZAMENTO : null;
          const workShift = typeof item.TURNOTRABALHO === 'number' && item.TURNOTRABALHO <= 32767 ? item.TURNOTRABALHO : null;

          const employeeData = {
            soc_code: item.CODIGO.toString(),  // Ensure string format
            company_id: companyId,
            company_soc_code: item.CODIGOEMPRESA ? item.CODIGOEMPRESA.toString() : null,
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
            gender: gender,
            pis: item.PIS,
            work_card: item.CTPS,
            work_card_series: item.SERIECTPS,
            marital_status: maritalStatus,
            contract_type: contractType,
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
            skin_color: skinColor,
            education: education,
            birthplace: item.NATURALIDADE,
            extension: item.RAMAL,
            shift_regime: shiftRegime,
            work_regime: item.REGIMETRABALHO,
            commercial_phone: item.TELCOMERCIAL,
            work_shift: workShift,
            hr_unit: item.RHUNIDADE,
            hr_sector: item.RHSETOR,
            hr_position: item.RHCARGO,
            hr_cost_center_unit: item.RHCENTROCUSTOUNIDADE,
            user_id: userId
          };

          // Try to find if this employee already exists
          const { data: existingEmployee } = await supabase
            .from('employees')
            .select('id')
            .eq('soc_code', item.CODIGO)
            .eq('user_id', userId)
            .maybeSingle();
            
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
            throw result.error;
          }
          
          console.log(`Successfully ${existingEmployee ? 'updated' : 'created'} employee ${item.CODIGO}`);
        },
        `employee ${item.CODIGO}`
      );
      
      success++;
    } catch (individualError) {
      console.error(`Error processing individual employee ${item?.CODIGO || 'unknown'}:`, individualError);
      error++;
    }
  }
  
  return { count: data.length, success, error };
}

// Function to process absenteeism batches with improved error handling and retries
async function processAbsenteeismBatch(supabase, data, userId) {
  console.log(`Processing batch of ${data.length} absenteeism records`);
  let success = 0;
  let error = 0;
  
  // Process each absenteeism record individually with retry logic
  for (const item of data) {
    try {
      await withRetry(
        async () => {
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
          
          // Ensure numeric fields don't exceed smallint range
          const gender = typeof item.SEXO === 'number' && item.SEXO <= 32767 ? item.SEXO : null;
          const certificateType = typeof item.TIPO_ATESTADO === 'number' && item.TIPO_ATESTADO <= 32767 ? item.TIPO_ATESTADO : null;
          
          // Find a company for this record (first one available)
          const { data: company } = await supabase
            .from('companies')
            .select('id')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle();
          
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
            company_id: company?.id || null,
            user_id: userId
          };
          
          // Check if this exact record already exists to avoid duplicates
          const { data: existingRecord } = await supabase
            .from('absenteeism')
            .select('id')
            .eq('employee_registration', item.MATRICULA_FUNC)
            .eq('primary_icd', item.CID_PRINCIPAL || '')
            .eq('start_date', item.DT_INICIO_ATESTADO ? new Date(item.DT_INICIO_ATESTADO).toISOString() : new Date().toISOString())
            .eq('end_date', item.DT_FIM_ATESTADO ? new Date(item.DT_FIM_ATESTADO).toISOString() : new Date().toISOString())
            .eq('user_id', userId)
            .maybeSingle();
            
          if (existingRecord) {
            // Já existe, vamos pular
            console.log(`Skipping duplicate absenteeism record for ${item.MATRICULA_FUNC}`);
            return; // Skip insert, count as success
          }
          
          // Always use insert for absenteeism records
          const { error: insertError } = await supabase
            .from('absenteeism')
            .insert(absenteeismData);
              
          if (insertError) {
            throw insertError;
          }
        },
        `absenteeism record for ${item.MATRICULA_FUNC || 'unknown'}`
      );
      
      success++;
    } catch (individualError) {
      console.error(`Error processing individual absenteeism record:`, individualError);
      error++;
    }
  }
  
  return { count: data.length, success, error };
}
