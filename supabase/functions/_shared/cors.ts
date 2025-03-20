
// Improved CORS headers helper with request-specific configuration
export const corsHeaders = (req?: Request) => {
  // Get the origin from the request or use wildcard as fallback
  const origin = req?.headers.get('origin') || '*';
  
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-time',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
};
