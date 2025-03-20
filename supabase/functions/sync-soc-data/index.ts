
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SOC_API_URL = 'https://ws1.soc.com.br/WebSoc/exportadados';

// Configuration constants
const MAX_EXECUTION_TIME_MS = 10 * 60 * 1000; // 10 minutes maximum execution time
const API_TIMEOUT_MS = 60 * 1000; // 1 minute API call timeout
const BATCH_SIZE = 50; // Process in smaller batches to prevent timeouts
const MAX_CONCURRENT_BATCHES = 3; // Limit concurrent processing

interface SyncOptions {
  type: 'company' | 'employee' | 'absenteeism';
  params?: Record<string, string>;
  parallel?: boolean;
  batchSize?: number;
  maxConcurrent?: number;
  resumeFromBatch?: number;
  resumeFromRecord?: number;
  syncId?: number; // To continue an existing sync
}

interface SyncState {
  syncId: number;
  userId: string;
  type: string;
  totalRecords: number;
  processedRecords: number;
  currentBatch: number;
  totalBatches: number;
  startTime: number;
  lastUpdateTime: number;
  cancelled: boolean;
}

// Global registry of active syncs
const activeSyncs = new Map<number, SyncState>();

// Check for cancellation requests
async function checkCancellation(supabase, syncId: number): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('sync_logs')
      .select('status')
      .eq('id', syncId)
      .single();
    
    if (error) {
      console.error(`Error checking cancellation status for sync ${syncId}:`, error);
      return false;
    }
    
    return data.status === 'cancelled';
  } catch (e) {
    console.error(`Exception checking cancellation for sync ${syncId}:`, e);
    return false;
  }
}

// Check if user has active syncs
async function userHasActiveSyncs(supabase, userId: string, excludeSyncId?: number): Promise<boolean> {
  try {
    let query = supabase
      .from('sync_logs')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress', 'processing', 'queued', 'started', 'continues'])
      .is('completed_at', null);
    
    if (excludeSyncId) {
      query = query.neq('id', excludeSyncId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error checking active syncs:', error);
      return false;
    }
    
    return data && data.length > 0;
  } catch (e) {
    console.error('Exception checking active syncs:', e);
    return false;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  const executionStartTime = Date.now();
  
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
    
    // Check if user already has active sync processes (excluding the one we're about to resume)
    const hasActiveSyncs = await userHasActiveSyncs(supabase, user.id, options.syncId);
    if (hasActiveSyncs) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Você já possui uma sincronização em andamento. Aguarde a conclusão antes de iniciar outra.`,
          code: 'ALREADY_SYNCING'
        }),
        { 
          status: 409, // Conflict
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    let syncId: number;
    let syncStatus: string;
    let syncMessage: string;
    
    // Create or resume a sync log entry
    if (options.syncId) {
      // Resume existing sync
      syncId = options.syncId;
      syncStatus = 'continues';
      syncMessage = `Resumindo sincronização de ${options.type} a partir do lote ${options.resumeFromBatch || 0}`;
      
      const { error: updateError } = await supabase
        .from('sync_logs')
        .update({
          status: syncStatus,
          message: syncMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', syncId);
      
      if (updateError) {
        console.error('Error updating sync log for resume:', updateError);
        return new Response(
          JSON.stringify({ success: false, message: 'Falha ao atualizar registro de sincronização para retomada' }),
          { 
            status: 500, 
            headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
          }
        );
      }
    } else {
      // Create new sync log
      const { data: logEntry, error: logError } = await supabase
        .from('sync_logs')
        .insert({
          type: options.type,
          status: 'pending',
          message: `Sincronização de ${options.type} iniciada`,
          user_id: user.id,
          started_at: new Date().toISOString()
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
      
      syncId = logEntry.id;
      syncStatus = 'in_progress';
      syncMessage = `Sincronização de ${options.type} em andamento`;
    }
    
    // Update log to in-progress
    await supabase
      .from('sync_logs')
      .update({ 
        status: syncStatus,
        message: syncMessage,
        updated_at: new Date().toISOString()
      })
      .eq('id', syncId);
    
    // Register this sync as active
    activeSyncs.set(syncId, {
      syncId,
      userId: user.id,
      type: options.type,
      totalRecords: 0,
      processedRecords: 0,
      currentBatch: options.resumeFromBatch || 0,
      totalBatches: 0,
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      cancelled: false
    });
    
    // Return success early while the sync continues in the background
    // This ensures the client gets a response quickly
    const response = new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sincronização de ${options.type} iniciada com sucesso`, 
        syncId,
        status: syncStatus,
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
    const processingPromise = processSyncInBackground(
      supabase, 
      options, 
      syncId, 
      user.id, 
      executionStartTime
    );
    
    // @ts-ignore - EdgeRuntime is available in Deno Deploy
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
async function processSyncInBackground(
  supabase, 
  options: SyncOptions, 
  syncId: number, 
  userId: string,
  executionStartTime: number
) {
  try {
    console.log(`Starting background sync process for ${options.type} with sync ID ${syncId}`);
    
    // Set up execution timeout
    const executionTimeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`MAX_EXECUTION_TIME_EXCEEDED: Sync process has been running for over ${MAX_EXECUTION_TIME_MS/60000} minutes`));
      }, MAX_EXECUTION_TIME_MS);
    });
    
    // Main sync process
    const syncProcess = async () => {
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
        activeSyncs.delete(syncId);
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
      
      // Check for cancellation before making API call
      const isCancelled = await checkCancellation(supabase, syncId);
      if (isCancelled) {
        console.log(`Sync ${syncId} was cancelled before API call`);
        await updateSyncLog(supabase, syncId, 'cancelled', `Sincronização de ${options.type} cancelada pelo usuário`);
        activeSyncs.delete(syncId);
        return;
      }
      
      const formattedParams = JSON.stringify(params);
      const apiUrl = `${SOC_API_URL}?parametro=${encodeURIComponent(formattedParams)}`;
      
      console.log(`Calling SOC API at: ${apiUrl}`);
      
      // Update log with API call starting
      await updateSyncLog(supabase, syncId, 'processing', `Chamando API SOC para ${options.type}`);
      
      // Make the API request with timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
      
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
          activeSyncs.delete(syncId);
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
          activeSyncs.delete(syncId);
          return;
        }
        
        const totalRecords = jsonData.length;
        console.log(`Received ${totalRecords} records from SOC API`);
        
        // Check for cancellation after API call
        const isCancelledAfterApi = await checkCancellation(supabase, syncId);
        if (isCancelledAfterApi) {
          console.log(`Sync ${syncId} was cancelled after API call`);
          await updateSyncLog(supabase, syncId, 'cancelled', `Sincronização de ${options.type} cancelada pelo usuário após obter dados da API`);
          activeSyncs.delete(syncId);
          return;
        }
        
        // Update active sync state
        const syncState = activeSyncs.get(syncId);
        if (syncState) {
          syncState.totalRecords = totalRecords;
          syncState.totalBatches = Math.ceil(totalRecords / BATCH_SIZE);
          activeSyncs.set(syncId, syncState);
        }
        
        // Update log with total records count
        await supabase
          .from('sync_logs')
          .update({ 
            total_records: totalRecords,
            processed_records: options.resumeFromRecord || 0,
            batch: options.resumeFromBatch || 0,
            total_batches: Math.ceil(totalRecords / BATCH_SIZE),
            updated_at: new Date().toISOString()
          })
          .eq('id', syncId);
        
        // Start from the resume point if specified
        const startBatch = options.resumeFromBatch || 0;
        const startRecord = options.resumeFromRecord || 0;
        
        // If we're not at the start, slice the array to continue from where we left off
        const remainingData = startRecord > 0 ? jsonData.slice(startRecord) : jsonData;
        
        // Process the data based on the type
        let processResult;
        const currentElapsedTime = Date.now() - executionStartTime;
        const timeRemaining = MAX_EXECUTION_TIME_MS - currentElapsedTime - 30000; // Leave 30 seconds margin
        
        if (timeRemaining <= 0) {
          // Not enough time to even start processing, schedule a continuation
          const recordsProcessed = options.resumeFromRecord || 0;
          await scheduleContinuation(
            supabase, 
            syncId, 
            options.type, 
            startBatch, 
            recordsProcessed, 
            totalRecords
          );
          return;
        }
        
        console.log(`Time remaining for processing: ${timeRemaining/1000} seconds`);
        
        switch (options.type) {
          case 'company':
            processResult = await processCompanyData(
              supabase, remainingData, userId, syncId, startBatch, executionStartTime
            );
            break;
          case 'employee':
            processResult = await processEmployeeData(
              supabase, remainingData, userId, syncId, startBatch, executionStartTime, {
                ...options,
                batchSize: options.batchSize || BATCH_SIZE,
                maxConcurrent: options.maxConcurrent || MAX_CONCURRENT_BATCHES
              }
            );
            break;
          case 'absenteeism':
            processResult = await processAbsenteeismData(
              supabase, remainingData, userId, syncId, startBatch, executionStartTime, {
                ...options,
                batchSize: options.batchSize || BATCH_SIZE,
                maxConcurrent: options.maxConcurrent || MAX_CONCURRENT_BATCHES
              }
            );
            break;
          default:
            throw new Error(`Unsupported data type: ${options.type}`);
        }
        
        if (processResult.needsContinuation) {
          await scheduleContinuation(
            supabase, 
            syncId, 
            options.type, 
            processResult.nextBatch, 
            processResult.totalProcessed, 
            totalRecords
          );
        } else {
          // Update the sync log with success
          await updateSyncLog(
            supabase,
            syncId,
            processResult.status || 'completed',
            `Sincronização de ${options.type} concluída: ${processResult.success} de ${processResult.total} registros processados`
          );
          
          console.log(`Sync ${syncId} completed successfully`);
          activeSyncs.delete(syncId);
        }
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
        
        activeSyncs.delete(syncId);
      }
    };
    
    // Race the sync process against the timeout
    await Promise.race([syncProcess(), executionTimeoutPromise]).catch(async (error) => {
      console.error(`Sync process ${syncId} terminated due to:`, error);
      
      if (error.message?.includes('MAX_EXECUTION_TIME_EXCEEDED')) {
        // This is a timeout, schedule a continuation
        const syncState = activeSyncs.get(syncId);
        if (syncState) {
          await scheduleContinuation(
            supabase, 
            syncId, 
            options.type, 
            syncState.currentBatch, 
            syncState.processedRecords, 
            syncState.totalRecords
          );
        } else {
          await updateSyncLog(
            supabase,
            syncId,
            'error',
            `Sincronização interrompida por tempo limite sem informações de progresso`
          );
        }
      } else {
        await updateSyncLog(
          supabase,
          syncId,
          'error',
          `Erro interno na sincronização: ${error.message}`,
          error.stack
        );
        
        activeSyncs.delete(syncId);
      }
    });
  } catch (error) {
    console.error(`Error during background sync process:`, error);
    
    // Update the sync log with error
    await supabase
      .from('sync_logs')
      .update({ 
        status: 'error',
        message: `Erro interno na sincronização: ${error.message}`,
        error_details: error.stack,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', syncId);
    
    activeSyncs.delete(syncId);
  }
}

// Schedule a continuation of this sync for later
async function scheduleContinuation(
  supabase,
  syncId: number,
  type: string,
  currentBatch: number,
  recordsProcessed: number,
  totalRecords: number
) {
  console.log(`Scheduling continuation for sync ${syncId} from batch ${currentBatch}, record ${recordsProcessed}`);
  
  try {
    // Update the sync log to indicate a continuation is needed
    await supabase
      .from('sync_logs')
      .update({
        status: 'needs_continuation',
        message: `Sincronização de ${type} será continuada automaticamente (${recordsProcessed}/${totalRecords} registros processados)`,
        processed_records: recordsProcessed,
        batch: currentBatch,
        updated_at: new Date().toISOString()
      })
      .eq('id', syncId);
    
    // Attempt to immediately create a continuation sync
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Get the original request parameters
        const { data: originalSync } = await supabase
          .from('sync_logs')
          .select('type, additional_info')
          .eq('id', syncId)
          .single();
          
        if (originalSync) {
          // Create a new sync request with continuation data
          const { data: newSync, error: newSyncError } = await supabase
            .from('sync_logs')
            .insert({
              type: originalSync.type,
              status: 'pending',
              message: `Continuação da sincronização #${syncId} a partir do registro ${recordsProcessed}/${totalRecords}`,
              user_id: user.id,
              parent_id: syncId,
              batch: currentBatch,
              total_batches: Math.ceil(totalRecords / 50), // Usando batchSize de 50
              processed_records: recordsProcessed,
              total_records: totalRecords,
              started_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();
            
          if (newSyncError) {
            console.error(`Error creating continuation sync:`, newSyncError);
          } else if (newSync) {
            console.log(`Created continuation sync #${newSync.id} for sync #${syncId}`);
            
            // Make a request to the sync endpoint with the continuation data
            const fetchUrl = `${supabase.supabaseUrl}/functions/v1/sync-soc-data`;
            
            const fetchOptions = {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabase.auth.token || ''}`
              },
              body: JSON.stringify({
                type: originalSync.type,
                syncId: newSync.id,
                resumeFromBatch: currentBatch,
                resumeFromRecord: recordsProcessed,
                parallel: true, // Enable parallel processing
                batchSize: 50,  // Smaller batch size
                maxConcurrent: 3
              })
            };
            
            // Fire and forget - we don't need to await this
            fetch(fetchUrl, fetchOptions)
              .then(response => {
                if (!response.ok) {
                  console.error(`Error response from continuation request: ${response.status}`);
                  return response.text().then(text => {
                    throw new Error(`Status ${response.status}: ${text}`);
                  });
                }
                return response.json();
              })
              .then(data => {
                console.log(`Continuation request successful:`, data);
              })
              .catch(error => {
                console.error(`Error sending continuation request:`, error);
              });
          }
        }
      }
    } catch (continuationError) {
      console.error(`Error trying to auto-continue sync:`, continuationError);
      // We'll still mark the original sync as needs_continuation so the user can manually retry
    }
    
    console.log(`Scheduled continuation for sync ${syncId}`);
    activeSyncs.delete(syncId);
    return true;
  } catch (error) {
    console.error(`Error scheduling continuation:`, error);
    
    await supabase
      .from('sync_logs')
      .update({
        status: 'error',
        message: `Erro ao agendar continuação: ${error.message}`,
        error_details: error.stack,
        updated_at: new Date().toISOString()
      })
      .eq('id', syncId);
    
    activeSyncs.delete(syncId);
    return false;
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
    message,
    updated_at: new Date().toISOString()
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
  
  // Update the active syncs registry
  const syncState = activeSyncs.get(syncId);
  if (syncState) {
    syncState.lastUpdateTime = Date.now();
    if (status === 'cancelled') {
      syncState.cancelled = true;
    }
    activeSyncs.set(syncId, syncState);
  }
}

// Process company data from SOC API
async function processCompanyData(
  supabase, 
  data: any[], 
  userId: string, 
  syncId: number,
  startBatch: number = 0,
  executionStartTime: number
) {
  let success = 0;
  let failed = 0;
  let currentBatch = startBatch;
  let needsContinuation = false;
  let totalProcessed = 0;
  
  const batchSize = BATCH_SIZE;
  const totalBatches = Math.ceil(data.length / batchSize);
  
  for (let i = 0; i < data.length; i += batchSize) {
    // Check if we've been running too long and need to continue later
    const currentElapsedTime = Date.now() - executionStartTime;
    if (currentElapsedTime > (MAX_EXECUTION_TIME_MS - 30000)) { // Leave 30 seconds margin
      console.log(`Process company data approaching max execution time (${currentElapsedTime/1000}s), will continue later`);
      needsContinuation = true;
      break;
    }
    
    // Check for cancellation
    const isCancelled = await checkCancellation(supabase, syncId);
    if (isCancelled) {
      console.log(`Sync ${syncId} was cancelled during company processing`);
      await updateSyncLog(supabase, syncId, 'cancelled', `Sincronização cancelada pelo usuário durante processamento`);
      activeSyncs.delete(syncId);
      return { 
        total: data.length, 
        success, 
        failed,
        status: 'cancelled',
        needsContinuation: false
      };
    }
    
    currentBatch++;
    const batch = data.slice(i, i + batchSize);
    console.log(`Processing company batch ${currentBatch} of ${totalBatches} (${batch.length} records)`);
    
    // Update sync state
    const syncState = activeSyncs.get(syncId);
    if (syncState) {
      syncState.currentBatch = currentBatch;
      syncState.processedRecords = totalProcessed;
      syncState.lastUpdateTime = Date.now();
      activeSyncs.set(syncId, syncState);
    }
    
    // Update progress in database
    await supabase
      .from('sync_logs')
      .update({ 
        batch: currentBatch,
        message: `Processando lote ${currentBatch} de ${totalBatches} (${batch.length} registros)`,
        processed_records: totalProcessed,
        updated_at: new Date().toISOString()
      })
      .eq('id', syncId);
    
    try {
      const companyData = batch.map(item => ({
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
      
      // Process in smaller sub-batches to prevent statement too large errors
      const SUB_BATCH_SIZE = 10;
      let batchSuccess = 0;
      
      for (let j = 0; j < companyData.length; j += SUB_BATCH_SIZE) {
        const subBatch = companyData.slice(j, j + SUB_BATCH_SIZE);
        
        const { error } = await supabase
          .from('companies')
          .upsert(subBatch, {
            onConflict: 'soc_code, user_id',
            ignoreDuplicates: false
          });
        
        if (error) {
          console.error(`Error upserting companies (sub-batch ${j}/${companyData.length}):`, error);
          failed += subBatch.length;
        } else {
          batchSuccess += subBatch.length;
          success += subBatch.length;
        }
      }
      
      totalProcessed += batch.length;
      
      console.log(`Company batch ${currentBatch} processed: ${batchSuccess} success, ${batch.length - batchSuccess} failed`);
      
    } catch (batchError) {
      console.error(`Error processing company batch ${currentBatch}:`, batchError);
      failed += batch.length;
      
      // Continue with next batch despite errors
      totalProcessed += batch.length;
    }
  }
  
  return {
    total: data.length,
    success,
    failed,
    totalProcessed,
    needsContinuation,
    nextBatch: currentBatch,
    status: failed > 0 ? (success > 0 ? 'completed_with_errors' : 'error') : 'completed'
  };
}

// Process employee data from SOC API
async function processEmployeeData(
  supabase, 
  data: any[], 
  userId: string, 
  syncId: number,
  startBatch: number = 0,
  executionStartTime: number,
  options: SyncOptions
) {
  let success = 0;
  let failed = 0;
  let needsContinuation = false;
  let totalProcessed = 0;
  
  const batchSize = options.batchSize || BATCH_SIZE;
  const maxConcurrent = options.maxConcurrent || MAX_CONCURRENT_BATCHES;
  const useParallel = options.parallel === true && data.length > batchSize;
  
  console.log(`Processing ${data.length} employee records, parallel: ${useParallel}`);
  
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
      batch: startBatch,
      message: `Processando ${data.length} funcionários em ${batches.length} lotes`,
      updated_at: new Date().toISOString()
    })
    .eq('id', syncId);
  
  let currentBatchIndex = startBatch;
  
  if (useParallel) {
    // Process batches in chunks of maxConcurrent
    for (let i = 0; i < batches.length; i += maxConcurrent) {
      // Check if execution time is approaching limit
      const currentElapsedTime = Date.now() - executionStartTime;
      if (currentElapsedTime > (MAX_EXECUTION_TIME_MS - 60000)) { // 1 minute margin
        console.log(`Process employee data approaching max execution time (${currentElapsedTime/1000}s), will continue later`);
        needsContinuation = true;
        break;
      }
      
      // Check for cancellation
      const isCancelled = await checkCancellation(supabase, syncId);
      if (isCancelled) {
        console.log(`Sync ${syncId} was cancelled during employee processing`);
        await updateSyncLog(supabase, syncId, 'cancelled', `Sincronização cancelada pelo usuário durante processamento`);
        activeSyncs.delete(syncId);
        return { 
          total: data.length, 
          success, 
          failed,
          totalProcessed,
          status: 'cancelled',
          needsContinuation: false
        };
      }
      
      const currentBatches = batches.slice(i, i + maxConcurrent);
      const batchPromises = currentBatches.map((batch, index) => 
        processEmployeeBatch(
          supabase, 
          batch, 
          userId, 
          i + index + 1, 
          batches.length, 
          syncId
        )
      );
      
      try {
        const batchResults = await Promise.all(batchPromises);
        
        // Update progress and sum results
        for (const result of batchResults) {
          success += result.success;
          failed += result.failed;
          totalProcessed += result.success + result.failed;
        }
        
        currentBatchIndex = i + maxConcurrent;
        
        // Update sync state
        const syncState = activeSyncs.get(syncId);
        if (syncState) {
          syncState.currentBatch = currentBatchIndex;
          syncState.processedRecords = totalProcessed;
          syncState.lastUpdateTime = Date.now();
          activeSyncs.set(syncId, syncState);
        }
      } catch (error) {
        console.error(`Error in parallel processing of employee batches:`, error);
        failed += currentBatches.reduce((sum, batch) => sum + batch.length, 0);
        totalProcessed += currentBatches.reduce((sum, batch) => sum + batch.length, 0);
      }
    }
  } else {
    // Process sequentially
    for (let i = 0; i < batches.length; i++) {
      // Check if execution time is approaching limit
      const currentElapsedTime = Date.now() - executionStartTime;
      if (currentElapsedTime > (MAX_EXECUTION_TIME_MS - 30000)) { // 30 second margin
        console.log(`Process employee data approaching max execution time (${currentElapsedTime/1000}s), will continue later`);
        needsContinuation = true;
        break;
      }
      
      // Check for cancellation
      const isCancelled = await checkCancellation(supabase, syncId);
      if (isCancelled) {
        console.log(`Sync ${syncId} was cancelled during employee processing`);
        await updateSyncLog(supabase, syncId, 'cancelled', `Sincronização cancelada pelo usuário durante processamento`);
        activeSyncs.delete(syncId);
        return { 
          total: data.length, 
          success, 
          failed,
          totalProcessed,
          status: 'cancelled',
          needsContinuation: false
        };
      }
      
      try {
        const result = await processEmployeeBatch(
          supabase, 
          batches[i], 
          userId, 
          i + 1, 
          batches.length, 
          syncId
        );
        
        success += result.success;
        failed += result.failed;
        totalProcessed += result.success + result.failed;
        currentBatchIndex = i + 1;
        
        // Update sync state
        const syncState = activeSyncs.get(syncId);
        if (syncState) {
          syncState.currentBatch = currentBatchIndex;
          syncState.processedRecords = totalProcessed;
          syncState.lastUpdateTime = Date.now();
          activeSyncs.set(syncId, syncState);
        }
      } catch (error) {
        console.error(`Error processing employee batch ${i + 1}:`, error);
        failed += batches[i].length;
        totalProcessed += batches[i].length;
      }
    }
  }
  
  return {
    total: data.length,
    success,
    failed,
    totalProcessed,
    needsContinuation,
    nextBatch: currentBatchIndex,
    status: failed > 0 ? (success > 0 ? 'completed_with_errors' : 'error') : 'completed'
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
      message: `Processando lote ${batchNumber} de ${totalBatches} (${batch.length} registros)`,
      updated_at: new Date().toISOString()
    })
    .eq('id', syncId);
  
  for (let i = 0; i < batch.length; i++) {
    try {
      // Update progress within batch every 10 items
      if (i % 10 === 0) {
        const { data } = await supabase
          .from('sync_logs')
          .select('processed_records')
          .eq('id', syncId)
          .single();
        
        const currentProcessed = data?.processed_records || 0;
        
        await supabase
          .from('sync_logs')
          .update({ 
            processed_records: currentProcessed + i,
            updated_at: new Date().toISOString()
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
  
  console.log(`Completed batch ${batchNumber}/${totalBatches}: ${batchSuccess} success, ${batchFailed} failed`);
  
  return {
    success: batchSuccess,
    failed: batchFailed
  };
}

// Process a single employee
async function processEmployeeItem(supabase, item: any, userId: string) {
  try {
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
      last_update_date: safeDate(item.DATAULTALTERACAO),
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
    
    if (existingEmployee) {
      // Update existing employee
      const { error } = await supabase
        .from('employees')
        .update(employeeData)
        .eq('id', existingEmployee.id);
        
      if (error) {
        console.error(`Error updating employee ${item.CODIGO}:`, error);
        return false;
      }
      return true;
    } else {
      // Insert new employee
      const { error } = await supabase
        .from('employees')
        .insert(employeeData);
        
      if (error) {
        console.error(`Error inserting employee ${item.CODIGO}:`, error);
        return false;
      }
      return true;
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
  startBatch: number = 0,
  executionStartTime: number,
  options: SyncOptions
) {
  let success = 0;
  let failed = 0;
  let needsContinuation = false;
  let totalProcessed = 0;
  
  const batchSize = options.batchSize || BATCH_SIZE;
  const maxConcurrent = options.maxConcurrent || MAX_CONCURRENT_BATCHES;
  const useParallel = options.parallel === true && data.length > batchSize;
  
  console.log(`Processing ${data.length} absenteeism records, parallel: ${useParallel}`);
  
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
      batch: startBatch,
      message: `Processando ${data.length} registros de absenteísmo em ${batches.length} lotes`,
      updated_at: new Date().toISOString()
    })
    .eq('id', syncId);
  
  let currentBatchIndex = startBatch;
  
  if (useParallel) {
    // Process batches in chunks of maxConcurrent
    for (let i = 0; i < batches.length; i += maxConcurrent) {
      // Check if execution time is approaching limit
      const currentElapsedTime = Date.now() - executionStartTime;
      if (currentElapsedTime > (MAX_EXECUTION_TIME_MS - 60000)) { // 1 minute margin
        console.log(`Process absenteeism data approaching max execution time (${currentElapsedTime/1000}s), will continue later`);
        needsContinuation = true;
        break;
      }
      
      // Check for cancellation
      const isCancelled = await checkCancellation(supabase, syncId);
      if (isCancelled) {
        console.log(`Sync ${syncId} was cancelled during absenteeism processing`);
        await updateSyncLog(supabase, syncId, 'cancelled', `Sincronização cancelada pelo usuário durante processamento`);
        activeSyncs.delete(syncId);
        return { 
          total: data.length, 
          success, 
          failed,
          totalProcessed,
          status: 'cancelled',
          needsContinuation: false
        };
      }
      
      const currentBatches = batches.slice(i, i + maxConcurrent);
      const batchPromises = currentBatches.map((batch, index) => 
        processAbsenteeismBatch(
          supabase, 
          batch, 
          userId, 
          i + index + 1, 
          batches.length, 
          syncId
        )
      );
      
      try {
        const batchResults = await Promise.all(batchPromises);
        
        // Update progress and sum results
        for (const result of batchResults) {
          success += result.success;
          failed += result.failed;
          totalProcessed += result.success + result.failed;
        }
        
        currentBatchIndex = i + maxConcurrent;
        
        // Update sync state
        const syncState = activeSyncs.get(syncId);
        if (syncState) {
          syncState.currentBatch = currentBatchIndex;
          syncState.processedRecords = totalProcessed;
          syncState.lastUpdateTime = Date.now();
          activeSyncs.set(syncId, syncState);
        }
      } catch (error) {
        console.error(`Error in parallel processing of absenteeism batches:`, error);
        failed += currentBatches.reduce((sum, batch) => sum + batch.length, 0);
        totalProcessed += currentBatches.reduce((sum, batch) => sum + batch.length, 0);
      }
    }
  } else {
    // Process sequentially
    for (let i = 0; i < batches.length; i++) {
      // Check if execution time is approaching limit
      const currentElapsedTime = Date.now() - executionStartTime;
      if (currentElapsedTime > (MAX_EXECUTION_TIME_MS - 30000)) { // 30 second margin
        console.log(`Process absenteeism data approaching max execution time (${currentElapsedTime/1000}s), will continue later`);
        needsContinuation = true;
        break;
      }
      
      // Check for cancellation
      const isCancelled = await checkCancellation(supabase, syncId);
      if (isCancelled) {
        console.log(`Sync ${syncId} was cancelled during absenteeism processing`);
        await updateSyncLog(supabase, syncId, 'cancelled', `Sincronização cancelada pelo usuário durante processamento`);
        activeSyncs.delete(syncId);
        return { 
          total: data.length, 
          success, 
          failed,
          totalProcessed,
          status: 'cancelled',
          needsContinuation: false
        };
      }
      
      try {
        const result = await processAbsenteeismBatch(
          supabase, 
          batches[i], 
          userId, 
          i + 1, 
          batches.length, 
          syncId
        );
        
        success += result.success;
        failed += result.failed;
        totalProcessed += result.success + result.failed;
        currentBatchIndex = i + 1;
        
        // Update sync state
        const syncState = activeSyncs.get(syncId);
        if (syncState) {
          syncState.currentBatch = currentBatchIndex;
          syncState.processedRecords = totalProcessed;
          syncState.lastUpdateTime = Date.now();
          activeSyncs.set(syncId, syncState);
        }
      } catch (error) {
        console.error(`Error processing absenteeism batch ${i + 1}:`, error);
        failed += batches[i].length;
        totalProcessed += batches[i].length;
      }
    }
  }
  
  return {
    total: data.length,
    success,
    failed,
    totalProcessed,
    needsContinuation,
    nextBatch: currentBatchIndex,
    status: failed > 0 ? (success > 0 ? 'completed_with_errors' : 'error') : 'completed'
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
      message: `Processando lote ${batchNumber} de ${totalBatches} (${batch.length} registros)`,
      updated_at: new Date().toISOString()
    })
    .eq('id', syncId);
  
  for (let i = 0; i < batch.length; i++) {
    try {
      // Update progress within batch every 10 items
      if (i % 10 === 0) {
        const { data } = await supabase
          .from('sync_logs')
          .select('processed_records')
          .eq('id', syncId)
          .single();
        
        const currentProcessed = data?.processed_records || 0;
        
        await supabase
          .from('sync_logs')
          .update({ 
            processed_records: currentProcessed + i,
            updated_at: new Date().toISOString()
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
  
  console.log(`Completed absenteeism batch ${batchNumber}/${totalBatches}: ${batchSuccess} success, ${batchFailed} failed`);
  
  return {
    success: batchSuccess,
    failed: batchFailed
  };
}

// Process a single absenteeism record
async function processAbsenteeismItem(supabase, item: any, userId: string) {
  try {
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
      .eq('start_date', safeDate(item.DT_INICIO_ATESTADO))
      .eq('primary_icd', item.CID_PRINCIPAL || '')
      .eq('user_id', userId)
      .maybeSingle();
    
    const absenteeismData = {
      unit: item.UNIDADE,
      sector: item.SETOR,
      employee_registration: item.MATRICULA_FUNC,
      employee_id: employeeId,
      birth_date: safeDate(item.DT_NASCIMENTO),
      gender: typeof item.SEXO === 'number' ? item.SEXO : null,
      certificate_type: typeof item.TIPO_ATESTADO === 'number' ? item.TIPO_ATESTADO : null,
      start_date: safeDate(item.DT_INICIO_ATESTADO) || new Date(),
      end_date: safeDate(item.DT_FIM_ATESTADO) || new Date(),
      start_time: item.HORA_INICIO_ATESTADO,
      end_time: item.HORA_FIM_ATESTADO,
      days_absent: typeof item.DIAS_AFASTADOS === 'number' ? item.DIAS_AFASTADOS : null,
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
