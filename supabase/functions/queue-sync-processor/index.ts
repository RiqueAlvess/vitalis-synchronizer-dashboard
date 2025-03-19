
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SOC_API_URL = 'https://ws1.soc.com.br/WebSoc/exportadados';

const BATCH_SIZE = 50; // Number of records to process at once

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
      
      console.log(`Received ${jsonData.length} records from SOC API`);
      
      // Update job status with total count
      jobStatus.set(job.id, { 
        ...jobStatus.get(job.id)!, 
        total: jsonData.length,
        processed: 0
      });
      
      // Process data in batches
      let processed = 0;
      const total = jsonData.length;
      
      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = jsonData.slice(i, Math.min(i + BATCH_SIZE, total));
        
        // Process batch based on type
        let processResult;
        
        switch (job.type) {
          case 'company':
            processResult = await processCompanyBatch(supabase, batch, job.userId);
            break;
          case 'employee':
            processResult = await processEmployeeBatch(supabase, batch, job.userId);
            break;
          case 'absenteeism':
            processResult = await processAbsenteeismBatch(supabase, batch, job.userId);
            break;
          default:
            throw new Error(`Unsupported data type: ${job.type}`);
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
              message: `Processado ${processed} de ${total} registros (${progress}%)`,
            })
            .eq('id', job.syncLogId);
        }
        
        console.log(`Processed batch ${i}-${i + batch.length} of ${total} (${progress}%)`);
        
        // Simulate some delay to not overwhelm the database
        // This would be handled by Bull's rate limiting in a real implementation
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Update job status to completed
      jobStatus.set(job.id, { 
        ...jobStatus.get(job.id)!, 
        status: 'completed',
        progress: 100
      });
      
      // Update sync log with success
      if (job.syncLogId) {
        await supabase
          .from('sync_logs')
          .update({
            status: 'completed',
            message: `Sincronização de ${job.type} concluída: ${processed} registros processados`,
            completed_at: new Date().toISOString()
          })
          .eq('id', job.syncLogId);
      }
      
      console.log(`Job ${job.id} completed successfully`);
      
    } catch (error) {
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
            error_details: error.stack,
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

// Function to process companies
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

// Function to process employees
async function processEmployeeBatch(supabase, data, userId) {
  console.log(`Processing batch of ${data.length} employees`);
  
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

// Function to process absenteeism
async function processAbsenteeismBatch(supabase, data, userId) {
  console.log(`Processing batch of ${data.length} absenteeism records`);
  
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

Deno.serve(async (req) => {
  // Handle CORS preflight requests
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
    
    const userId = session.user.id;
    
    // Handle different endpoints
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();
    
    if (req.method === 'POST' && path === 'enqueue') {
      // Handle job enqueuing
      const { type, params } = await req.json();
      
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
