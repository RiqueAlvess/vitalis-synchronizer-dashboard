
// _shared/cors.ts
export const corsHeaders = (req?: Request) => {
  // Use the Origin header if available, otherwise allow all origins
  const origin = req?.headers.get('Origin') || '*';
  
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };
};

// Export error codes for better standardization
export const ERROR_CODES = {
  UNAUTHORIZED: 'auth/unauthorized',
  INVALID_REQUEST: 'request/invalid',
  DB_ERROR: 'database/error',
  API_ERROR: 'api/error',
  DATA_PROCESSING_ERROR: 'processing/error',
  UNKNOWN_ERROR: 'unknown/error',
};

// Helper function for logging with context
export const logWithContext = (context: string, message: string, data: any = null) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}][${context}] ${message}`;
  
  if (data) {
    console.log(logMessage, data);
  } else {
    console.log(logMessage);
  }
};

// Helper for standardized error responses
export const syncErrorResponse = (
  req: Request, 
  message: string, 
  status: number = 500, 
  error: any = null, 
  code: string = ERROR_CODES.UNKNOWN_ERROR
) => {
  console.error(`Error response (${status}): ${message}`, error);
  
  return new Response(
    JSON.stringify({ 
      success: false, 
      message, 
      error: error?.message || null,
      code
    }),
    { 
      status, 
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
    }
  );
};
