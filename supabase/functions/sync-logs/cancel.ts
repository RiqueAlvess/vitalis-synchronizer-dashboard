
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders, syncErrorResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }
  
  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // Get the session to verify authentication
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.error("Unauthorized attempt to cancel sync - no session found");
      return syncErrorResponse(
        req,
        'Não autenticado. Por favor, faça login novamente.',
        401,
        null,
        'auth/unauthorized'
      );
    }
    
    // Parse request body
    const body = await req.json();
    const syncId = body.syncId;
    const force = !!body.force; // Force flag to bypass some checks
    
    if (!syncId) {
      console.error("Missing required syncId parameter");
      return syncErrorResponse(
        req,
        'Parâmetro obrigatório ausente: syncId',
        400,
        null,
        'request/invalid'
      );
    }
    
    console.log(`Cancelling sync process ${syncId} for user ${session.user.id}, force=${force}`);
    
    // Check if the sync log exists and belongs to the user
    const { data: syncLog, error: fetchError } = await supabase
      .from('sync_logs')
      .select('id, status, type, message, started_at, completed_at, user_id')
      .eq('id', syncId)
      .single();
    
    if (fetchError) {
      console.error(`Error fetching sync log ${syncId}:`, fetchError);
      return syncErrorResponse(
        req,
        `Erro ao buscar registro de sincronização ${syncId}`,
        500,
        fetchError,
        'database/error'
      );
    }
    
    if (!syncLog) {
      console.error(`Sync log ${syncId} not found`);
      return syncErrorResponse(
        req,
        `Registro de sincronização ${syncId} não encontrado`,
        404,
        null,
        'database/error'
      );
    }
    
    // Verify the sync log belongs to the user
    if (syncLog.user_id !== session.user.id && !force) {
      console.error(`User ${session.user.id} attempted to cancel sync ${syncId} belonging to user ${syncLog.user_id}`);
      return syncErrorResponse(
        req,
        'Você não tem permissão para cancelar esta sincronização',
        403,
        null,
        'auth/unauthorized'
      );
    }
    
    // Skip cancellation if it's already completed or cancelled and force is not set
    if (['completed', 'error', 'cancelled'].includes(syncLog.status) && !force) {
      console.log(`Sync process ${syncId} already ${syncLog.status}, no need to cancel`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Sincronização ${syncId} já está ${syncLog.status}, não é necessário cancelar`,
          syncId,
          type: syncLog.type,
          status: syncLog.status
        }),
        { 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const now = new Date().toISOString();
    
    // Update the sync log to cancelled status
    const { error: updateError } = await supabase
      .from('sync_logs')
      .update({
        status: 'cancelled',
        message: 'Processo cancelado pelo usuário',
        completed_at: now,
        updated_at: now
      })
      .eq('id', syncId);
    
    if (updateError) {
      console.error(`Error updating sync log ${syncId}:`, updateError);
      return syncErrorResponse(
        req,
        `Erro ao atualizar registro de sincronização ${syncId}`,
        500,
        updateError,
        'database/error'
      );
    }
    
    // Also update any child processes that might be running as part of this sync
    try {
      const { error: childUpdateError } = await adminClient
        .from('sync_logs')
        .update({
          status: 'cancelled',
          message: 'Processo cancelado pelo usuário (processo pai)',
          completed_at: now,
          updated_at: now
        })
        .eq('parent_id', syncId);
      
      if (childUpdateError) {
        console.warn(`Error updating child sync logs for ${syncId}:`, childUpdateError);
      }
    } catch (e) {
      console.error(`Failed to update child processes for sync ${syncId}:`, e);
    }
    
    // Signal other systems about the cancellation by creating a cancellation record
    try {
      await adminClient
        .from('sync_cancellations')
        .upsert({
          sync_id: syncId,
          user_id: session.user.id,
          cancelled_at: now,
          force: force
        });
      console.log(`Created cancellation signal record for sync ${syncId}`);
    } catch (e) {
      console.warn(`Failed to create cancellation signal record:`, e);
    }
    
    console.log(`Successfully cancelled sync ${syncId}`);
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sincronização ${syncId} cancelada com sucesso`,
        syncId,
        type: syncLog.type
      }),
      { 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Unexpected error in cancel function:', error);
    return syncErrorResponse(
      req,
      'Erro interno no servidor',
      500,
      error,
      'unknown/error'
    );
  }
});
