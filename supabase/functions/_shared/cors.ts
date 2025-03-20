
// CORS headers with standardized approach to error handling
export const corsHeaders = (req) => {
  const origin = req.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, x-request-time',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true',
  };
};

// Standard error responses for synchronization errors
export const syncErrorResponse = (req, message, status = 500, details = null, code = null) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  if (details) {
    response.details = details;
  }

  if (code) {
    response.code = code;
  }

  return new Response(
    JSON.stringify(response),
    {
      status,
      headers: {
        ...corsHeaders(req),
        'Content-Type': 'application/json'
      }
    }
  );
};

// Error codes for synchronization
export const ERROR_CODES = {
  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  
  // Synchronization errors
  SYNC_IN_PROGRESS: 'SYNC_IN_PROGRESS',
  SYNC_NOT_FOUND: 'SYNC_NOT_FOUND',
  SYNC_CANCELLED: 'SYNC_CANCELLED',
  SYNC_TIMED_OUT: 'SYNC_TIMED_OUT',
  
  // API configuration errors
  API_CONFIG_MISSING: 'API_CONFIG_MISSING',
  API_INVALID_PARAMS: 'API_INVALID_PARAMS',
  
  // SOC API errors
  SOC_API_ERROR: 'SOC_API_ERROR',
  SOC_API_TIMEOUT: 'SOC_API_TIMEOUT',
  
  // Data processing errors
  INVALID_DATA_FORMAT: 'INVALID_DATA_FORMAT',
  DATA_PROCESSING_ERROR: 'DATA_PROCESSING_ERROR',
  
  // Database errors
  DB_ERROR: 'DB_ERROR',
  DB_INSERT_ERROR: 'DB_INSERT_ERROR',
  DB_UPDATE_ERROR: 'DB_UPDATE_ERROR',
  
  // General errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  MAX_EXECUTION_TIME_EXCEEDED: 'MAX_EXECUTION_TIME_EXCEEDED'
};

// Helper function to extract error messages from different error types
export const extractErrorMessage = (error) => {
  if (!error) return 'Unknown error';
  
  if (typeof error === 'string') return error;
  
  if (error instanceof Error) return error.message;
  
  if (error.message) return error.message;
  
  if (error.error) return extractErrorMessage(error.error);
  
  return JSON.stringify(error);
};

// Utility for standard logging with timestamp and contextual information
export const logWithContext = (context, message, data = null) => {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[${timestamp}] [${context}] ${message}`, data);
  } else {
    console.log(`[${timestamp}] [${context}] ${message}`);
  }
};
