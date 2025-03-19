
/**
 * CORS headers for Supabase Edge Functions
 */
export const corsHeaders = (req: Request) => {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5174',
    'https://preview--vitalis-synchronizer-dashboard.lovable.app',
    'https://vitalis-synchronizer-dashboard.lovable.app'
  ];

  // Default headers for all responses
  let headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true'
  };

  // Add origin if it's in the allowed list or if we're in development
  if (allowedOrigins.includes(origin) || origin.includes('localhost')) {
    return {
      ...headers,
      'Access-Control-Allow-Origin': origin
    };
  }

  // If origin is not in the allowed list, use '*' (less secure but ensures basic functionality)
  return {
    ...headers,
    'Access-Control-Allow-Origin': '*'
  };
};
