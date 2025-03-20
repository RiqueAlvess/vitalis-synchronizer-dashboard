
// Helper function to handle CORS for Supabase Edge Functions
export const corsHeaders = (req?: Request) => {
  // Get origin from request or use wildcard
  const origin = req?.headers.get('origin') || '*';
  
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-time, cache-control',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    // Allow credentials for authenticated requests
    ...(origin !== '*' ? { 'Access-Control-Allow-Credentials': 'true' } : {})
  };
};

// Standard response for CORS preflight requests
export const handleCorsPreflightRequest = (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: corsHeaders(req),
      status: 204 // No content is more appropriate for OPTIONS
    });
  }
  return null;
};

// Helper to create a standardized error response
export const createErrorResponse = (message: string, status = 500, details: any = null, req?: Request) => {
  console.error(`Error: ${message}`, details);
  return new Response(
    JSON.stringify({ 
      success: false, 
      message, 
      ...(details ? { details } : {}) 
    }),
    { 
      status, 
      headers: { 
        ...corsHeaders(req), 
        'Content-Type': 'application/json' 
      } 
    }
  );
};

// Helper to create a standardized success response
export const createSuccessResponse = (data: any, message?: string, req?: Request) => {
  return new Response(
    JSON.stringify({ 
      success: true, 
      ...(message ? { message } : {}),
      ...data 
    }),
    { 
      status: 200, 
      headers: { 
        ...corsHeaders(req), 
        'Content-Type': 'application/json' 
      } 
    }
  );
};
