
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SOC_API_URL = 'https://ws1.soc.com.br/WebSoc/exportadados';

// Smaller batch size to prevent timeouts and improve reliability
const BATCH_SIZE = 30; 
// Maximum time for a single batch operation in milliseconds
const BATCH_TIMEOUT = 60000; // 1 minute

interface SyncJob {
  id: string;
  type: 'company' | 'employee' | 'absenteeism';
  params: Record<string, string>;
  userId: string;
  syncLogId?: number;
}

interface SyncResponse {
  success: boolean;
  message: string;
  jobId?: string;
  status?: string;
  error?: string;
  processed?: number;
  total?: number;
}

// In-memory queue simulation (in a real implementation this would use Redis via Bull)
const queue: SyncJob[] = [];
const jobStatus = new Map<string, {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  total?: number;
  processed?: number;
  error?: string;
  result?: any;
}>();

// Process jobs in background
let isProcessing = false;
async function processQueue() {
  if (isProcessing || queue.length === 0) return;
  
  isProcessing = true;
  console.log(`Starting queue processing with ${queue.length} jobs`);
  
  try {
    const job = queue.shift();
    if (!job) {
      isProcessing = false;
      return;
    }
    
    // Update job status
    jobStatus.set(job.id, { 
      status: 'processing', 
      progress: 0,
    });
    
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Update sync log if we have one
    if (job.syncLogId) {
      await supabase
        .from('sync_logs')
        .update({
          status: 'in_progress',
          message: `Processando sincronização de ${job.type}`,
        })
        .eq('id', job.syncLogId);
    }
    
    // Call SOC API
    try {
      console.log(`Processing job ${job.id} of type ${job.type}`);
      
      // Format request parameters for SOC API
      const formattedParams = JSON.stringify(job.params);
      const apiUrl = `${SOC_API_URL}?parametro=${encodeURIComponent(formattedParams)}`;
      
      console.log(`Calling SOC API at: ${apiUrl}`);
      
      // Make the API request with timeout protection
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 seconds timeout
      
      try {
        const response = await fetch(apiUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
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
        
        console.log(`Received ${jsonData.length} records from SOC API`);
        
        // Update job status with total count
        jobStatus.set(job.id, { 
          ...jobStatus.get(job.id)!, 
          total: jsonData.length,
          processed: 0
        });
        
        // Update sync log with total count
        if (job.syncLogId) {
          await supabase
            .from('sync_logs')
            .update({
              total_records: jsonData.length,
              message: `Iniciando processamento de ${jsonData.length} registros`,
              batch: 0,
              total_batches: Math.ceil(jsonData.length / BATCH_SIZE)
            })
            .eq('id', job.syncLogId);
        }
        
        // Process data in batches with error recovery
        let processed = 0;
        const total = jsonData.length;
        const totalBatches = Math.ceil(total / BATCH_SIZE);
        
        // Track success and error counts
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < total; i += BATCH_SIZE) {
          const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
          const batch = jsonData.slice(i, Math.min(i + BATCH_SIZE, total));
          console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} records)`);
          
          try {
            // Update batch info in sync log
            if (job.syncLogId) {
              await supabase
                .from('sync_logs')
                .update({
                  batch: batchNumber,
                  message: `Processando lote ${batchNumber} de ${totalBatches} (${batch.length} registros)`,
                  processed_records: processed,
                })
                .eq('id', job.syncLogId);
            }
            
            // Process batch with timeout protection
            let processResult;
            const batchPromise = (async () => {
              try {
                switch (job.type) {
                  case 'company':
                    return await processCompanyBatch(supabase, batch, job.userId);
                  case 'employee':
                    return await processEmployeeBatch(supabase, batch, job.userId);
                  case 'absenteeism':
                    return await processAbsenteeismBatch(supabase, batch, job.userId);
                  default:
                    throw new Error(`Unsupported data type: ${job.type}`);
                }
              } catch (batchError) {
                console.error(`Error processing batch ${batchNumber}:`, batchError);
                throw batchError;
              }
            })();
            
            // Add timeout protection for batch processing
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error(`Batch ${batchNumber} processing timed out`)), BATCH_TIMEOUT);
            });
            
            try {
              processResult = await Promise.race([batchPromise, timeoutPromise]);
              successCount += batch.length;
            } catch (batchError) {
              // Log but continue with next batch
              console.error(`Error in batch ${batchNumber}:`, batchError);
              errorCount += batch.length;
              
              // Update sync log with the error but don't fail the whole job
              if (job.syncLogId) {
                await supabase
                  .from('sync_logs')
                  .update({
                    error_count: (errorCount || 0) + batch.length,
                    error_details: `Erro no lote ${batchNumber}: ${batchError.message}\n${errorCount > 0 ? 'Erros anteriores existem. ' : ''}`,
                    message: `Sincronização continua após erro no lote ${batchNumber}. Processando próximo lote.`,
                    status: 'continues' // Special status to indicate recovery
                  })
                  .eq('id', job.syncLogId);
              }
            }
            
            processed += batch.length;
            
            // Update progress
            const progress = Math.round((processed / total) * 100);
            jobStatus.set(job.id, { 
              ...jobStatus.get(job.id)!, 
              progress,
              processed
            });
            
            // Update sync log with progress
            if (job.syncLogId) {
              await supabase
                .from('sync_logs')
                .update({
                  message: `Progresso: ${processed} de ${total} registros (${progress}%)`,
                  processed_records: processed,
                  success_count: successCount,
                  error_count: errorCount
                })
                .eq('id', job.syncLogId);
            }
            
            console.log(`Processed batch ${batchNumber}/${totalBatches} (${progress}%)`);
            
            // Add a small delay between batches to prevent overwhelming the database
            await new Promise(resolve => setTimeout(resolve, 500));
            
          } catch (batchError) {
            console.error(`Fatal error in batch ${batchNumber}:`, batchError);
            
            // Update sync log with the error but continue
            if (job.syncLogId) {
              await supabase
                .from('sync_logs')
                .update({
                  error_count: (errorCount || 0) + batch.length,
                  error_details: `Erro fatal no lote ${batchNumber}: ${batchError.message}`,
                  status: 'continues',
                  message: `Erro no processamento do lote ${batchNumber}, tentando continuar com o próximo lote.`
                })
                .eq('id', job.syncLogId);
            }
            
            // Continue with next batch
            errorCount += batch.length;
          }
        }
        
        // Update job status to completed
        jobStatus.set(job.id, { 
          ...jobStatus.get(job.id)!, 
          status: 'completed',
          progress: 100
        });
        
        // Update sync log with success (even if there were some errors)
        const finalStatus = errorCount > 0 ? 
          (successCount > 0 ? 'completed_with_errors' : 'error') : 
          'completed';
        
        if (job.syncLogId) {
          await supabase
            .from('sync_logs')
            .update({
              status: finalStatus,
              message: `Sincronização de ${job.type} concluída: ${processed} registros processados (${successCount} com sucesso, ${errorCount} com erros)`,
              completed_at: new Date().toISOString(),
              success_count: successCount,
              error_count: errorCount
            })
            .eq('id', job.syncLogId);
        }
        
        console.log(`Job ${job.id} completed with status: ${finalStatus}. Success: ${successCount}, Errors: ${errorCount}`);
        
      } catch (error) {
        clearTimeout(timeoutId);
        console.error(`Error processing job ${job.id}:`, error);
        
        // Update job status to failed
        jobStatus.set(job.id, { 
          ...jobStatus.get(job.id)!, 
          status: 'failed',
          error: error.message
        });
        
        // Update sync log with error
        if (job.syncLogId) {
          await supabase
            .from('sync_logs')
            .update({
              status: 'error',
              message: `Falha na sincronização de ${job.type}: ${error.message}`,
              error_details: error.stack || error.message,
              completed_at: new Date().toISOString()
            })
            .eq('id', job.syncLogId);
        }
      }
      
    } catch (error) {
      console.error(`Unhandled error in processQueue for job ${job.id}:`, error);
      
      // In case of an unhandled error, update the sync log
      if (job.syncLogId) {
        await supabase
          .from('sync_logs')
          .update({
            status: 'error',
            message: `Erro não tratado: ${error.message}`,
            error_details: error.stack || error.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', job.syncLogId);
      }
    }
    
  } finally {
    isProcessing = false;
    
    // Continue processing the queue
    if (queue.length > 0) {
      processQueue();
    }
  }
}

// Function to process companies (more resilient)
async function processCompanyBatch(supabase, data, userId) {
  console.log(`Processing batch of ${data.length} companies`);
  
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
  
  try {
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
  } catch (error) {
    console.error('Error in processCompanyBatch:', error);
    throw error;
  }
}

// Function to process employees (more resilient)
async function processEmployeeBatch(supabase, data, userId) {
  console.log(`Processing batch of ${data.length} employees`);
  
  // Prepare data with null handling to prevent field type mismatches
  const employeeData = data.map(item => {
    // Helper function to safely convert to date or null
    const safeDate = (dateStr) => {
      if (!dateStr) return null;
      try {
        return new Date(dateStr);
      } catch (e) {
        console.warn(`Invalid date: ${dateStr}`);
        return null;
      }
    };
    
    return {
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
      birth_date: safeDate(item.DATA_NASCIMENTO),
      hire_date: safeDate(item.DATA_ADMISSAO),
      termination_date: safeDate(item.DATA_DEMISSAO),
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
      last_update_date: safeDate(item.DATAULTERACAO),
      hr_registration: item.MATRICULARH,
      skin_color: typeof item.COR === 'number' ? item.COR : null,
      education: typeof item.ESCOLARIDADE === 'number' ? item.ESCOLARIDADE : null,
      birthplace: item.NATURALIDADE,
      extension: item.RAMAL,
      shift_regime: typeof item.REGIMEREVEZAMENTO === 'number' ? item.REGIMEREVEZAMENTO : null,
      work_regime: item.REGIMETRABALHO,
      commercial_phone: item.TELCOMERCIAL,
      work_shift: typeof item.TURNOTRABALHO === 'number' ? item.TURNOTRABALHO : null,
      hr_unit: item.RHUNIDADE,
      hr_sector: item.RHSETOR,
      hr_position: item.RHCARGO,
      hr_cost_center_unit: item.RHCENTROCUSTOUNIDADE,
      user_id: userId
    };
  });
  
  try {
    // Process in smaller sub-batches to prevent too large statements
    const SUB_BATCH_SIZE = 10;
    for (let i = 0; i < employeeData.length; i += SUB_BATCH_SIZE) {
      const subBatch = employeeData.slice(i, i + SUB_BATCH_SIZE);
      
      const { error } = await supabase
        .from('employees')
        .upsert(subBatch, {
          onConflict: 'soc_code, user_id',
          ignoreDuplicates: false
        });
      
      if (error) {
        console.error(`Error upserting employees (sub-batch ${i}/${employeeData.length}):`, error);
        throw error;
      }
    }
    
    return { count: employeeData.length };
  } catch (error) {
    console.error('Error in processEmployeeBatch:', error);
    throw error;
  }
}

// Function to process absenteeism records (more resilient)
async function processAbsenteeismBatch(supabase, data, userId) {
  console.log(`Processing batch of ${data.length} absenteeism records`);
  
  try {
    // Prepare data with null handling
    const absenteeismData = data.map(item => {
      // Helper function to safely convert to date or current date
      const safeDate = (dateStr) => {
        if (!dateStr) return new Date();
        try {
          return new Date(dateStr);
        } catch (e) {
          console.warn(`Invalid date: ${dateStr}, using current date`);
          return new Date();
        }
      };
      
      return {
        unit: item.UNIDADE,
        sector: item.SETOR,
        employee_registration: item.MATRICULA_FUNC,
        birth_date: item.DT_NASCIMENTO ? safeDate(item.DT_NASCIMENTO) : null,
        gender: typeof item.SEXO === 'number' ? item.SEXO : null,
        certificate_type: typeof item.TIPO_ATESTADO === 'number' ? item.TIPO_ATESTADO : null,
        start_date: safeDate(item.DT_INICIO_ATESTADO),
        end_date: safeDate(item.DT_FIM_ATESTADO),
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
    });
    
    // Process in smaller sub-batches to prevent too large statements
    const SUB_BATCH_SIZE = 10;
    for (let i = 0; i < absenteeismData.length; i += SUB_BATCH_SIZE) {
      const subBatch = absenteeismData.slice(i, i + SUB_BATCH_SIZE);
      
      const { error } = await supabase
        .from('absenteeism')
        .insert(subBatch);
      
      if (error) {
        console.error(`Error inserting absenteeism records (sub-batch ${i}/${absenteeismData.length}):`, error);
        throw error;
      }
    }
    
    return { count: absenteeismData.length };
  } catch (error) {
    console.error('Error in processAbsenteeismBatch:', error);
    throw error;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }
  
  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();
    console.log('Request path:', path);
    
    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
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
    
    // Extract token
    const token = authHeader.replace('Bearer ', '');
    
    // Get the session
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    // Check if user is authenticated
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Authentication failed' 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const userId = user.id;
    console.log('Authenticated user:', userId);
    
    // Handle different endpoints
    if (req.method === 'POST' && path === 'enqueue') {
      // Handle job enqueuing
      const requestData = await req.json();
      const { type, params } = requestData;
      console.log('Enqueue request:', { type, params });
      
      if (!type || !params) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Missing required parameters: type and params' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
          }
        );
      }
      
      // Create a new sync log entry
      const { data: logEntry, error: logError } = await supabase
        .from('sync_logs')
        .insert({
          type,
          status: 'queued',
          message: `Sincronização de ${type} adicionada à fila`,
          user_id: userId,
          started_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (logError) {
        console.error('Error creating sync log entry:', logError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Failed to create sync log entry' 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
          }
        );
      }
      
      console.log('Created sync log entry:', logEntry);
      
      // Generate a unique job ID
      const jobId = crypto.randomUUID();
      
      // Create a new job
      const job: SyncJob = {
        id: jobId,
        type,
        params,
        userId,
        syncLogId: logEntry.id
      };
      
      // Add job to queue
      queue.push(job);
      
      // Initialize job status
      jobStatus.set(jobId, {
        status: 'queued',
        progress: 0
      });
      
      // Start processing the queue if not already processing
      processQueue();
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Sincronização de ${type} adicionada à fila`,
          jobId,
          logId: logEntry.id
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    else if (req.method === 'GET' && path === 'status') {
      // Handle job status checking
      const url = new URL(req.url);
      const jobId = url.searchParams.get('jobId');
      
      if (!jobId) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Missing required parameter: jobId' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
          }
        );
      }
      
      // Get job status
      const status = jobStatus.get(jobId);
      
      if (!status) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: `Job with ID ${jobId} not found` 
          }),
          { 
            status: 404, 
            headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
          }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          ...status
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Default response for invalid endpoints
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Invalid endpoint' 
      }),
      { 
        status: 404, 
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
